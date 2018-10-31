
const vm = require('vm');
const EventEmitter = require('events');
const messages = require('./messages');
const Logger = require('@hkube/logger');
const component = 'AlgorunnerMock';

let log;

const STOP_MARK = 'got stop command';

class AlgorunnerMock extends EventEmitter {
    constructor() {
        super();
        this._input = {};
        this._stopEmitter = new EventEmitter();
    }

    async init(options) {
        log = Logger.GetLogFromContainer();
    }

    start() {
        this.emit('connection');
    }

    send(message) {
        switch (message.command) {
            case messages.incomming.initialize:
                this._initialize(message.data);
                break;
            case messages.incomming.start:
                this._start(message.data);
                break;
            case messages.incomming.subPipelineStarted:
                this._subPipelineStarted(message.data);
                break;
            case messages.incomming.subPipelineDone:
                this._subPipelineDone(message.data);
                break;
            case messages.incomming.subPipelineError:
                this._subPipelineError(message.data);
                break;
            case messages.incomming.subPipelineStopped:
                this._subPipelineStopped(message.data);
                break;
            case messages.incomming.cleanup:
                this._simulateSend({ command: messages.incomming.done, data: message.data });
                break;
            case messages.incomming.stop:
                this._stop({ command: messages.incomming.stopped, data: message.data });
                break;

            default:
        }
    }

    /**
     * Simulate a stopSubPipeline message for subPieline
     * @param {string} subPipelineId alg internal subPipeline Id
     * @param {string} reason 
     */
    simulateStopSubPipeline(subPipelineId, reason) {
        log.info(`sending stopSubPipeline ${subPipelineId}...`, { component });
        this._simulateSend({
            command: messages.outgoing.stopSubPipeline,
            data: {
                subPipelineId,
                reason
            }
        });
    }

    /**
     * Simulate a done message for pipeline
     * @param {*} result 
     */
    simulateDone(result) {
        log.info(`sending done...`, { component });
        this._simulateSend({
            command: messages.outgoing.done,
            data: result
        });
    }

    getStartedSubPipelineId() {
        return this._startedSubPipelineId;
    }

    _simulateSend(message) {
        this.emit(message.command, message);
    }

    _codeResolver(code, input) {
        return new Promise((resolve, reject) => {
            let stopped = false;
            this._stopEmitter.on('stop', () => {
                stopped = true;
                return resolve(STOP_MARK);
            })
            const userFunctionPromise = Promise.resolve(vm.runInThisContext(`(${code})`)(input));

            userFunctionPromise.then((result) => {
                this._stopEmitter.removeAllListeners();
                if (!stopped) {
                    return resolve(result);
                }
            }).catch(error => {
                this._stopEmitter.removeAllListeners();
                return reject(new Error(`failed to eval code: ${error.message}`));
            })
        });
    }

    /**
     * Send error messga e to worker
     * @param {object} error 
     */
    _sendError(error) {
        log.error(error.message, { component });
        this._simulateSend({
            command: messages.outgoing.error,
            error: {
                code: 'Failed',
                message: `Error: ${error.message || error}`,
                details: error.stackTrace
            }
        });
    }

    _isRawPipeline(subPipeline) {
        return subPipeline && subPipeline.nodes;
    }

    /**
     * Send startRawSubPipeline/startStoredSubPipeline to worker
     * @param {object} subPipeline 
     * @param {string} subPipelineId 
     */
    _startSubPipeline(subPipeline, subPipelineId) {
        log.debug(`send startRawSubPipeline id=${subPipeline} with input=${this._input}`, { component });
        subPipeline.flowInput = {
            data: this._input
        };
        const command = this._isRawPipeline(subPipeline) ? messages.outgoing.startRawSubPipeline : messages.outgoing.startStoredSubPipeline;
        this._simulateSend({
            command,
            data: {
                subPipeline,
                subPipelineId    // Algorithm actually needs to generate and manage the IDs
            }
        });
    }


    _initialize(data) {
        /**
         * algorunner flow:
         * - if code exists => eval code on input
         * - if condition exists => eval condition
         * - if contidion is true => send subPipelineStart message for trueSubPipeline with current result as input
         * - else (contidion is false) => send subPipelineStart message for falseSubPipeline with current result as input
         */
        this._input = data && data.input;
        const info = data && data.info;
        const extraData = info && info.extraData && info.extraData || {};
        this._code = extraData && extraData.code && extraData.code.join('\n');
        this._condition = extraData && extraData.conditionCode && extraData.conditionCode.join('\n');
        this._trueSubPipeline = extraData.trueSubPipeline;
        this._falseSubPipeline = extraData.falseSubPipeline;
        this._simulateSend({ command: messages.outgoing.initialized });
        log.debug(`got 'initialize' command with data: ${JSON.stringify(data)}`, { component });
    }


    async _start(data) {
        log.debug(`running with input: ${JSON.stringify(this._input)}`);
        this._simulateSend({
            command: messages.outgoing.started
        });

        // eval code
        if (this._code) {
            log.debug(`start eval code...`);
            try {
                this._input = await this._codeResolver(this._code, this._input);
                log.debug(`end eval code, result: ${this._input}`, { component });
            }
            catch (error) {
                this._sendError(new Error(`failed to eval code: ${error.message}`));
            }
        }
        // if no code make it single result (like code output)
        else if (this._input instanceof Array && this._input.length > 0) {
            this._input = this._input[0];
        }

        if (this._condition) {
            // eval condition
            log.debug(`start eval condition...`, { component });
            // const conditionResult = this.evalCode(this._condition, _currentResult);
            try {
                this._conditionResult = await this._codeResolver(this._condition, [this._input]);
                log.debug(`end eval condition, result: ${this._conditionResult}`, { component });
            }
            catch (error) {
                this._sendError(new Error(`failed to eval condition: ${error.message}`));
            }

            if (this._conditionResult) {
                if (this._trueSubPipeline) {
                    this._startSubPipeline(this._trueSubPipeline, 'trueSubPipeline');
                    return;
                }
                else {
                    log.warn(`condition is true but no trueSubPipeline`, { component });
                }
            }
            else {
                if (this._falseSubPipeline) {
                    this._startSubPipeline(this._falseSubPipeline, 'falseSubPipeline');
                    return;
                }
                else {
                    log.warning(`condition is false but no falseSubPipeline`, { component });
                }
            }
        }

        this._simulateSend({
            command: messages.outgoing.done,
            data: this._input
        });
    }

    /**
     * Handle subpipeline started event from worker
     * @param {object} data 
     */
    _subPipelineStarted(data) {
        const subPipelineId = data && data.subPipelineId;
        log.debug(`subpipeline ${subPipelineId} started`, { component });
        this._startedSubPipelineId = subPipelineId;
    }

    /**
     * handle subpipeline done event from worker
     * @param {object} data 
     */
    _subPipelineDone(data) {
        let subPipelineId = data && data.subPipelineId;
        let response = data && data.response;
        if (subPipelineId && response && (response instanceof Array)) {
            if (subPipelineId !== this.getStartedSubPipelineId()) {
                this._sendError(new Error(`got subpipeline done for unknown id=${subPipelineId}`));
                return;
            }
            log.debug(`got subpipeline id=${subPipelineId} done: result=${response[0].result}, wait 1000 ms to send done`)
            setTimeout(() => {
                this._simulateSend({
                    command: messages.outgoing.done,
                    data: response[0].result
                });
            }, 1000);
        }
        else {
            log.debug(`got subpipeline done error command, sending error`, { component })
            this._sendError(new Error(`SubPipelineError - got invalid subPipelineDone, subPipelineId=${subPipelineId}`));
        }
    }

    /**
     * handle subpipeline stopped
     * @param {object} data 
     */
    _subPipelineStopped(data) {
        // possible alg option: send alg error because the subPipeline stopped
        let subPipelineId = data && data.subPipelineId;
        this._sendError(new Error(`Failed because subpipeline ${subPipelineId} stopped`));
    }

    /**
     * handle subpipeline error event from worker
     * @param {object} data 
     */
    _subPipelineError(data) {
        let error = data && data.error;
        let subPipelineId = data && data.subPipelineId;
        log.debug(`got subpipeline ${subPipelineId} error command, sending error`, { component });
        this._sendError(new Error(`SubPipelineError - subPipelineId=${subPipelineId}: ${error}`));
    }

    /**
     * handle stop event
     * @param {object} data 
     */
    _stop(data) {
        if (process.env.IGNORE_STOP) {
            return;
        }
        this._stopEmitter.emit(messages.incomming.stop);
        this._simulateSend({
            command: messages.outgoing.stopped
        });
    }

    /**
     * handle exit event
     * @param {object} data 
     */
    _exit(data) {
        const code = (data && data.exitCode) | 0;
        log.info(`got exit command. Exiting with code ${code}`, { component });
    }
}

module.exports = AlgorunnerMock;