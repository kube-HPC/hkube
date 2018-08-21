const uuidv4 = require('uuid/v4');
const vm = require('vm');
const { JobResult } = require('@hkube/etcd');
const storageFactory = require('../../lib/helpers/datastoreHelper');
const discovery = require('../../lib/states/discovery');
const { Status, ApiServerPostTypes } = require('../../lib/consts/index');
const EventEmitter = require('events');

class ApiServerClientMock extends EventEmitter {
    constructor() {
        super();
        this._stoppedJobIds = new Set();
    }

    /**
     * Mock POST of subpipeline to ApiServer
     * @param {object} subPipeline
     * @param {string} type RAW or STORED from const/postSubPipelineType.js
     */
    postSubPipeline(subPipeline, type) {
        if (type === ApiServerPostTypes.SubPipeline.STORED) {
            return {
                error: "ApiServerClientMock doesn't support Stored pipeline"
            };
        }
        // generate jobId
        const jobId = uuidv4();

        setTimeout(async () => {
            const firstNode = subPipeline && subPipeline.nodes && subPipeline.nodes[0];
            const input = [subPipeline && subPipeline.flowInput && subPipeline.flowInput.data];
            const code = firstNode && firstNode.extraData && firstNode.extraData.code && firstNode.extraData.code.join('\n');
            if (!input) {
                this._storeError('no input');
            }
            else if (!code) {
                this._storeError('no code available for first node');
            }
            else {
                // eval code
                try {
                    const output = await this._codeResolver(code, input);
                    if (!this.isStopped(jobId)) {
                        this._storeDone(jobId, output);
                    }
                }
                catch (error) {
                    if (!this.isStopped(jobId)) {
                        this._storeError(jobId, new Error(`failed to eval code: ${error.message}`));
                    }
                }
            }

        }, 1000);

        return { jobId };
    }

    async postStopSubPipeline(jobId) {
        // save jobId as stopped
        this._stoppedJobIds.add(jobId);
        // mark subPipeline as stopped in storage
        const options = {
            jobId,
            startTime: Date.now(),
            status: Status.STOPPED
        }
        await discovery._etcd.jobResults.set({ jobId, data: new JobResult(options) });
        this.emit('stop');
    }

    isStopped(jobId) {
        return (this._stoppedJobIds.has(jobId));
    }

    async _storeDone(jobId, output) {
        const results = [{ result: output }];
        const storageInfo = await storageFactory.getAdapter().putResults({ jobId, data: results });
        const options = {
            jobId,
            data: { storageInfo },
            startTime: Date.now(),
            status: Status.COMPLETED,
        }
        await discovery._etcd.jobResults.set({ jobId, data: new JobResult(options) });
    }

    async _storeError(jobId, error) {
        const options = {
            jobId,
            startTime: Date.now(),
            status: Status.FAILED,
            error: error.message
        }
        await discovery._etcd.jobResults.set({ jobId, data: new JobResult(options) });
    }

    _codeResolver(code, input) {
        this.subPipelinePromise = new Promise((resolve, reject) => {
            this.on('stop', () => {
                return reject('stopped');
            });
            const userFunctionPromise = Promise.resolve(vm.runInThisContext(`(${code})`)(input));
            userFunctionPromise.then((result) => {
                return resolve(result);
            }).catch(error => {
                return reject(new Error(`failed to compile code: ${error.message}`));
            })
        });
        return this.subPipelinePromise;
    }

}

module.exports = new ApiServerClientMock();
