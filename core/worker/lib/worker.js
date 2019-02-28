const Logger = require('@hkube/logger');
const { tracer } = require('@hkube/metrics');
const stateManager = require('./states/stateManager');
const jobConsumer = require('./consumer/JobConsumer');
const algoRunnerCommunication = require('./algorithm-communication/workerCommunication');
const discovery = require('./states/discovery');
const { stateEvents, EventMessages, workerStates, workerCommands, Components } = require('../lib/consts');
const kubernetes = require('./helpers/kubernetes');
const messages = require('./algorithm-communication/messages');
const subpieline = require('./subpipeline/subpipeline');

const component = Components.WORKER;
const DEFAULT_STOP_TIMEOUT = 5000;
let log;

class Worker {
    constructor() {
        this._stopTimeout = null;
    }

    preInit() {
        log = Logger.GetLogFromContainer();
        this._registerToConnectionEvents();
    }

    async init(options) {
        this._inTerminationMode = false;
        this._options = options;
        this._debugMode = options.debugMode;
        this._registerToCommunicationEvents();
        this._registerToStateEvents();
        this._registerToEtcdEvents();
        this._stopTimeoutMs = options.timeouts.stop || DEFAULT_STOP_TIMEOUT;
        this._setInactiveTimeout();
    }

    _setInactiveTimeout() {
        if (jobConsumer.isConsumerPaused) {
            this._inactiveTimeoutMs = this._options.timeouts.inactivePaused || 0;
        }
        else {
            this._inactiveTimeoutMs = this._options.timeouts.inactive || 0;
        }
        this._handleTimeout(stateManager.state);
    }

    _registerToEtcdEvents() {
        discovery.on(EventMessages.STOP, async (res) => {
            log.info(`got stop: ${res.reason}`, { component });
            // stop registered subpipelines first
            const reason = `parent pipeline stopped: ${res.reason}`;
            await subpieline.stopAllSubPipelines(reason);
            // then stop worker
            stateManager.stop();
        });
        discovery.on(workerCommands.coolDown, async () => {
            log.info('got coolDown event', { component });
            jobConsumer.hotWorker = false;
            await jobConsumer.updateDiscovery({ state: stateManager.state });
            this._setInactiveTimeout();
        });
        discovery.on(workerCommands.warmUp, async () => {
            log.info('got warmUp event', { component });
            jobConsumer.hotWorker = true;
            await jobConsumer.updateDiscovery({ state: stateManager.state });
            this._setInactiveTimeout();
        });
        discovery.on(workerCommands.stopProcessing, async () => {
            if (!jobConsumer.isConsumerPaused) {
                await jobConsumer.pause();
                await jobConsumer.updateDiscovery({ state: stateManager.state });
                this._setInactiveTimeout();
            }
        });
        discovery.on(workerCommands.startProcessing, async () => {
            if (stateManager.state === workerStates.exit) {
                return;
            }
            if (jobConsumer.isConsumerPaused) {
                await jobConsumer.resume();
                await jobConsumer.updateDiscovery({ state: stateManager.state });
                this._setInactiveTimeout();
            }
        });
    }

    _registerToConnectionEvents() {
        algoRunnerCommunication.on('connection', () => {
            if (stateManager.state === workerStates.exit) {
                return;
            }
            log.info('starting bootstrap state', { component });
            stateManager.bootstrap();
            log.info('finished bootstrap state', { component });
        });
        algoRunnerCommunication.on('disconnect', async (reason) => {
            if (stateManager.state === workerStates.exit) {
                return;
            }
            log.warning(`algorithm runner has disconnected, reason: ${reason}`, { component });
            if (!this._debugMode) {
                const type = jobConsumer.getAlgorithmType();
                const containerStatus = await this._getAlgorunnerContainerStatus();
                const message = {
                    command: 'errorMessage',
                    error: {
                        code: 'Failed',
                        message: `algorithm ${type} has disconnected, reason: ${reason}. algorithm container status is ${JSON.stringify(containerStatus)}`
                    }
                };
                stateManager.done(message);
            }
        });
    }

    async _getAlgorunnerContainerStatus() {
        await kubernetes.waitForTerminatedState(this._options.kubernetes.pod_name, 'algorunner', 1000);
        const status = await kubernetes.getPodContainerStatus(this._options.kubernetes.pod_name); // eslint-disable-line no-await-in-loop
        const containerStatus = status && status.find(s => s.name === 'algorunner');
        return containerStatus;
    }

    /**
     * Register to algoRunner messages.
     */
    _registerToCommunicationEvents() {
        algoRunnerCommunication.on(messages.incomming.initialized, () => {
            stateManager.start();
        });
        algoRunnerCommunication.on(messages.incomming.done, (message) => {
            stateManager.done(message);
        });
        algoRunnerCommunication.on(messages.incomming.stopped, (message) => {
            if (this._stopTimeout) {
                clearTimeout(this._stopTimeout);
            }
            stateManager.done(message);
        });
        algoRunnerCommunication.on(messages.incomming.progress, (message) => {
            if (message.data) {
                log.debug(`progress: ${message.data.progress}`, { component });
            }
        });
        algoRunnerCommunication.on(messages.incomming.error, async (message) => {
            const errText = message.error && message.error.message;
            log.error(`got error from algorithm: ${errText}`, { component });
            // clean remind subPipelines
            const reason = `parent algorithm failed: ${errText}`;
            await subpieline.stopAllSubPipelines(reason);
            // finish (with error)
            stateManager.done(message);
        });
        algoRunnerCommunication.on(messages.incomming.startSpan, (message) => {
            this._startAlgorithmSpan(message);
        });
        algoRunnerCommunication.on(messages.incomming.finishSpan, (message) => {
            this._finishAlgorithmSpan(message);
        });
    }

    /**
     * Ensure worker is in 'working' state
     * @param {string} operation operation for which this validation is requested
     * @returns true if in 'working' state, else false
     */
    _validateWorkingState(operation) {
        if (stateManager.state === workerStates.working) {
            return true;
        }
        log.warning(`cannot ${operation} if not in working state`, { component });
        return false;
    }

    /**
     * Start new algorithm span
     * @param message startSpan message
     * @param message.data.name span name
     * @param message.data.tags tags object to be added to span (optional)
     */
    _startAlgorithmSpan(message) {
        if (!this._validateWorkingState('startSpan for algorithm')) {
            return;
        }
        const { data } = message;
        if (!data || !data.name) {
            log.error(`invalid startSpan message: ${JSON.stringify(message, 2, null)}`);
            return;
        }
        const spanOptions = {
            name: data.name,
            id: jobConsumer.taskId,
            tags: {
                ...data.tags,
                jobId: jobConsumer.jobId,
                taskId: jobConsumer.taskId,
            }
        };
        // set parent span
        if (!jobConsumer.algTracer.topSpan(jobConsumer.taskId)) {
            const topWorkerSpan = tracer.topSpan(jobConsumer.taskId);
            if (topWorkerSpan) {
                spanOptions.parent = topWorkerSpan.context();
            }
            else {
                spanOptions.parent = jobConsumer._job.data.spanId;
            }
        }
        // start span
        jobConsumer.algTracer.startSpan(spanOptions);
    }

    /**
     * Finish algorithm span
     * @param message finishSpan message
     * @param message.data.error error message (optional)
     * @param message.data.tags tags object to be added to span (optional)
     */
    _finishAlgorithmSpan(message) {
        if (!this._validateWorkingState('finishSpan for algorithm')) {
            return;
        }
        const { data } = message;
        if (!data) {
            log.warning(`invalid finishSpan message: ${JSON.stringify(message, 2, null)}`);
            return;
        }
        const topSpan = jobConsumer.algTracer.topSpan(jobConsumer.taskId);
        if (topSpan) {
            if (data.tags) {
                topSpan.addTag(data.tags);
            }
            topSpan.finish(data.error);
        }
        else {
            log.warning('got finishSpan request but algorithm span stack is empty!');
        }
    }

    async handleExit(code) {
        if (!this._inTerminationMode) {
            this._inTerminationMode = true;
            try {
                log.info(`starting termination mode. Exiting with code ${code}`, { component });
                this._tryToSendCommand({ command: messages.outgoing.exit });
                const terminated = await kubernetes.waitForTerminatedState(this._options.kubernetes.pod_name, 'algorunner');
                if (terminated) {
                    log.info(`algorithm container terminated. Exiting with code ${code}`, { component });
                }
                else { // if not terminated, kill job
                    const jobName = await kubernetes.getJobForPod(this._options.kubernetes.pod_name);
                    if (jobName) {
                        await kubernetes.deleteJob(jobName);
                        log.info(`deleted job ${jobName}`, { component });
                    }
                }
            }
            catch (error) {
                log.error(`failed to handle exit: ${error}`, { component });
            }

            try {
                // clean all registered subPiplines, if exist
                const reason = 'parent pipeline exit';
                await subpieline.stopAllSubPipelines(reason);
            }
            catch (error) {
                log.error(`failed to stop subpipeline/s: ${error}`, { component });
            }
            finally {
                this._inTerminationMode = false;
                process.exit(code);
            }
        }
    }

    _tryToSendCommand(message) {
        try {
            return algoRunnerCommunication.send(message);
        }
        catch (err) {
            log.error(`Failed to send command ${message.command}`, { component });
            return err;
        }
    }

    _handleTimeout(state) {
        if (state === workerStates.ready) {
            if (this._inactiveTimer) {
                clearTimeout(this._inactiveTimer);
                this._inactiveTimer = null;
            }
            if (!jobConsumer.hotWorker && this._inactiveTimeoutMs != 0) { // eslint-disable-line
                log.info(`starting inactive timeout for worker ${this._inactiveTimeoutMs / 1000} seconds`, { component });
                this._inactiveTimer = setTimeout(() => {
                    if (!this._inTerminationMode) {
                        log.info(`worker is inactive for more than ${this._inactiveTimeoutMs / 1000} seconds.`, { component });
                        stateManager.exit();
                    }
                }, this._inactiveTimeoutMs);
            }
        }
        else if (this._inactiveTimer) {
            log.info(`worker is active (${state}). Clearing inactive timeout`, { component });
            clearTimeout(this._inactiveTimer);
            this._inactiveTimer = null;
        }
    }

    _registerToStateEvents() {
        stateManager.on(stateEvents.stateEntered, async ({ job, state, results }) => {
            let pendingTransition = null;
            let reason = null;
            log.info(`Entering state: ${state}`, { component });
            const result = { state, results };
            this._handleTimeout(state);
            switch (state) {
                case workerStates.exit:
                    this.handleExit(0);
                    break;
                case workerStates.results:
                    // finish job
                    await jobConsumer.finishJob(result);
                    pendingTransition = stateManager.cleanup.bind(stateManager);
                    break;
                case workerStates.ready:
                    // clean all registered subPiplines, if exist
                    reason = `parent algorithm entered state ${state}`;
                    await subpieline.stopAllSubPipelines(reason);
                    break;
                case workerStates.init: {
                    // start init
                    const { error, data } = await jobConsumer.extractData(job.data);
                    if (!error) {
                        algoRunnerCommunication.send({
                            command: messages.outgoing.initialize,
                            data
                        });
                    }
                    break;
                }
                case workerStates.working:
                    algoRunnerCommunication.send({
                        command: messages.outgoing.start
                    });
                    break;
                case workerStates.shutdown:
                    break;
                case workerStates.error:
                    break;
                case workerStates.stop:
                    this._stopTimeout = setTimeout(() => {
                        log.error('Timeout exceeded trying to stop algorithm.', { component });
                        stateManager.done('Timeout exceeded trying to stop algorithm');
                        this.handleExit(0);
                    }, this._stopTimeoutMs);
                    algoRunnerCommunication.send({
                        command: messages.outgoing.stop
                    });
                    break;
                default:
            }
            await jobConsumer.updateDiscovery(result);
            if (pendingTransition) {
                pendingTransition();
            }
        });
    }
}

module.exports = new Worker();
