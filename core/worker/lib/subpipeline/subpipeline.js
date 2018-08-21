const algoRunnerCommunication = require('../algorunnerCommunication/workerCommunication');
const discovery = require('../states/discovery');
const Logger = require('@hkube/logger');
const storageFactory = require('../helpers/datastoreHelper');
const messages = require('../algorunnerCommunication/messages');
const component = require('../../common/consts/componentNames').WORKER;
const { Status, EventMessages, ApiServerPostTypes } = require('../consts/index');
const apiServerClient = require('../helpers/api-server-client');
const jobConsumer = require('../consumer/JobConsumer');
const stateManager = require('../states/stateManager');
const { workerStates } = require('../../common/consts/states');
const { stateEvents } = require('../../common/consts/events');

let log;

class SubPipelineHandler {
    init() {
        log = Logger.GetLogFromContainer();  
        // subpipeline IDs mapping: jobId => internal alg subpipeline Id       
        this._jobId2InternalIdMap = new Map();

        this._registerToEtcdEvents();
        this._registerToAlgEvents();
        this._registerToStateEvents();
    }

    _registerToEtcdEvents() {
        // handle subpipeline job completed
        discovery.on(`${EventMessages.JOB_RESULT}-${Status.COMPLETED}`, (result) => {
            const subpipelineId = this._getAndCleanAlgSubPipelineId(result);
            this._handleSubPipelineCompleted(result, subpipelineId);
        });

        // handle subpipeline job stopped
        discovery.on(`${EventMessages.JOB_RESULT}-${Status.STOPPED}`, (result) => {
            const subpipelineId = this._getAndCleanAlgSubPipelineId(result);
            this._handleSubPipelineStopped(result, subpipelineId);
        });

        // handle subpipeline job failed
        discovery.on(`${EventMessages.JOB_RESULT}-${Status.FAILED}`, (result) => {
            const subPipelineId = this._getAndCleanAlgSubPipelineId(result);
            if (!this._validateWorkingState(subPipelineId, 'send subPipelineError', false)) {
                return;
            }    
            const err = (result.error || 'subpipeline job failed');
            this._handleJobError(err, subPipelineId);
        });

        // handle parent pipeline stop request
        discovery.on(EventMessages.STOP, (res) => {
            log.info(`got stop: ${res.reason}`, { component });
            // stop all subPipelines
            const reason = `parent pipeline stopped: ${res.reason}`;
            this.stopAllSubPipelines(reason);
        });
    }

    _registerToAlgEvents() {
        // handle 'startRawSubPipeline' from algorithm
        algoRunnerCommunication.on(messages.incomming.startRawSubPipeline, (message) => {
            this._handleStartSubPipeline(message, ApiServerPostTypes.SubPipeline.RAW);
        });

        // handle 'startStoredSubPipeline' from algorithm
        algoRunnerCommunication.on(messages.incomming.startStoredSubPipeline, (message) => {
            this._handleStartSubPipeline(message, ApiServerPostTypes.SubPipeline.STORED);
        });

        // handle 'stopSubPipeline' from algorithm
        algoRunnerCommunication.on(messages.incomming.stopSubPipeline, (message) => {
            this._handleStopSubPipeline(message);
        });
    }

    _registerToStateEvents() {
        stateManager.on(stateEvents.stateEntered, ({state}) => {
            switch (state) {
                case workerStates.init:
                case workerStates.results:
                case workerStates.error: {
                    // clear all subPipelines
                    const keys = Array.from(this._jobId2InternalIdMap.keys());
                    if (keys.length > 0) {
                        const keysStr = keys.reduce((result, item) => {
                            return `${result} ${item}`;
                        }, '');
                        log.warning(`by entering state ${state} there are still ${keys.length} active subPipelines: ${keysStr} - Delete them...`);
                        this._jobId2InternalIdMap.clear();
                    }
                    break;
                }
                default:
            }
        });
    }

    /**
     * Delete jobId/subPipelineId mapping and unwatch subpipline job results.
     * @param {object} result 
     * @returns {string} alg subPiplineId (correlates to result.jobId)
     */
    _getAndCleanAlgSubPipelineId(result) {
        // clean subPipeline Id mapping
        const subPipelineId = this._jobId2InternalIdMap.get(result.jobId);
        log.debug(`got result, status=${result.status}, jobId: ${result.jobId}, alg subPipelineId: ${subPipelineId}`, { component });
        if (!subPipelineId) {
            log.warning(`got result with unknown jobId: ${result.jobId}`, { component });
        }
        this._jobId2InternalIdMap.delete(result.jobId);
        // unwatch subPipeline job results
        this.unwatchJobResults(result.jobId);
        
        return subPipelineId;
    }

    /**
     * Unwatch subPipeline job results
     * @param {string} subPipelineJobId 
     */
    async unwatchJobResults(subPipelineJobId) {
        try {
            await discovery.unWatchJobResults({ jobId: subPipelineJobId });
        }
        catch (error) {
            log.warning(`error during unWatchJobResults for jobId: ${subPipelineJobId}: ${error.message}`, { component });
        }
    }

    /**
     * Ensure worker is in 'working' state
     * @param {string} subPipelineId 
     * @param {string} operation operation for which this validation is requested
     * @param {boolean} doSendSubPipelineError if true send subPipelineError to alg
     * @returns true if in 'working' state, else false
     */
    _validateWorkingState(subPipelineId, operation, doSendSubPipelineError) {
        if (stateManager.state === workerStates.working) {
            return true;
        }
        const err = `cannot ${operation} while in ${stateManager.state} state`;
        log.error(err, { component });
        if (doSendSubPipelineError) {
            this._handleJobError(err, subPipelineId);
        }
        return false;
    }

    /**
     * Handle subPipeline completed
     * @param {object} result 
     * @param {string} subPipelineId 
     */
    async _handleSubPipelineCompleted(result, subPipelineId) {
        if (!this._validateWorkingState(subPipelineId, 'send subPipelineDone', false)) {
            return;
        }
        // get subpipeline results from storage
        const { data, error } = await storageFactory.getResults(result);
        if (error) {
            this._handleJobError(error.message, subPipelineId);
            return;
        }
        if (!data) {
            this._handleJobError(`got invalid result from storage for ${result.jobId}`, subPipelineId);
            return;
        }
        // send subPipelineDone to alg
        algoRunnerCommunication.send({
            command: messages.outgoing.subPipelineDone,
            data: {
                response: data,
                subPipelineId
            }
        });
    }

    /**
     * Handle subPipeline stopped
     * @param {object} result 
     * @param {string} subPipelineId 
     */
    _handleSubPipelineStopped(result, subPipelineId) {
        log.warning(`SubPipeline alg ${subPipelineId} stopped, send subPipelineStopped to alg`, { component });
        if (!this._validateWorkingState(subPipelineId, 'send subPipelineStopped', false)) {
            return;
        }
        algoRunnerCommunication.send({
            command: messages.outgoing.subPipelineStopped,
            data: {
                subPipelineId
            }
        });
    }
    
    /**
     * Handle subPipeline job error
     * @param {string} error error message
     * @param {string} subPipelineId internal algorothm subpipeline Id
     */
    async _handleJobError(error, subPipelineId) {
        log.error(`SubPipeline ${subPipelineId} job error: ${error}`, { component });
        algoRunnerCommunication.send({
            command: messages.outgoing.subPipelineError,
            data: {
                subPipelineId,
                error
            }
        });
    }

    /**
     * Handle algorithm request to stop a sub pipeline.
     * @param {object} message 
     */
    _handleStopSubPipeline(message) {
        const data = message && message.data;
        const subPipelineId = data && data.subPipelineId;
        const subPipelineJobId = this.getSubPipelineJobId(subPipelineId);
        log.debug(`got stopSubPipeline for alg subPipelineId ${subPipelineId} - subPipeline jobId: ${subPipelineJobId}`, { component });
        if (!this._validateWorkingState(subPipelineId, 'stop subPipeline', false)) {
            return;
        }
        if (!subPipelineJobId) {
            log.warning(`ignore stopSubPipeline: alg subPipelineId ${subPipelineId} not found`, { component });
            this._handleJobError(`cannot stop subPipeline - not found: ${subPipelineId}`, subPipelineId);
            return;
        }
        const reason = `stopped by algorithm: ${data && data.reason}`;
        this._stopSubPipeline(subPipelineJobId, reason);
    }

    /**
     * Handle algorithm request to start a sub pipeline.
     * @param {object} message message
     * @param {string} subPipelineType
     */
    async _handleStartSubPipeline(message, subPipelineType) {
        const data = message && message.data;
        const subPipeline = data && data.subPipeline;
        const subPipelineId = data && data.subPipelineId;
        log.debug(`got startSubPipeline ${subPipeline.name} from algorithm`, { component });
        if (!this._validateWorkingState(subPipelineId, 'start subPipeline', false)) {
            return;
        }
        if (!subPipeline) {
            this._handleJobError("bad 'startSubPipeline' message: 'subPipeline' object is missing", subPipelineId);
            return;
        }
        if (!subPipelineId) {
            this._handleJobError("bad 'startSubPipeline' message: 'subPipelineId' is missing", subPipelineId);
            return;
        }

        // send subPiplineStarted to alg
        algoRunnerCommunication.send({
            command: messages.outgoing.subPiplineStarted,
            data: {
                subPipelineId
            }
        });
        // post subPipeline
        try {
            const {jobId, taskId} = jobConsumer;
            const subPipelineToPost = { ...subPipeline, jobId, taskId }; // add jobId, taskId
            const response = await apiServerClient.postSubPipeline(subPipelineToPost, subPipelineType);
            if (response) {
                const subPipelineJobId = response.jobId;
                // map jobId/subPipelineId
                this._jobId2InternalIdMap.set(subPipelineJobId, subPipelineId);
                log.debug(`SubPipeline posted, alg subPipelineId=${subPipelineId}, jobId=${subPipelineJobId}`, { component });
                const result = await discovery.watchJobResults({ jobId: subPipelineJobId });
                if (result) {
                    log.debug(`got immediate results, status=${result.status}, jobId: ${subPipelineJobId}`, { component });
                    const algSubPipelineId = this._getAndCleanAlgSubPipelineId({...result, jobId: subPipelineJobId});
                    if (result.status === Status.COMPLETED) {
                        this._handleSubPipelineCompleted(result, algSubPipelineId);
                    }
                    else if (result.status === Status.STOPPED) {
                        this._handleSubPipelineStopped(result, algSubPipelineId);
                    }
                    else {
                        const err = (result.error || 'subpipeline job failed');
                        this._handleJobError(err, algSubPipelineId);
                    }
                }
            }
            else {
                throw new Error('post subPipeline got no response');
            }
        }
        catch (error) {
            this._handleJobError(error.message, subPipelineId);
        }
    }

    /**
     * Stop a single subPipeline
     * @param {string} subPipelineJobId 
     * @param {string} reason 
     */
    async _stopSubPipeline(subPipelineJobId, reason) {
        try {
            this.unwatchJobResults(subPipelineJobId);
            await apiServerClient.postStopSubPipeline(subPipelineJobId, reason);
        }
        catch (error) {
            log.warning(`failed to post stop request for subPipeline ${subPipelineJobId}: ${error.message}`, { component });
        }
    }

    /**
     * Stop all active subPipelinese
     * @param reason
     */
    stopAllSubPipelines(reason) {
        // stop all subPipelines
        log.debug('stopping all subPipelines...', { component });
        this._jobId2InternalIdMap.forEach((subPipelineId, subPipelineJobId) => {
            this._stopSubPipeline(subPipelineJobId, reason);
        });
        // clean subPipelines IDs
        this._jobId2InternalIdMap.clear();
    }

    /**
     * Get subPipeline jobId by alg subPipelineId
     * @param {*} algSubPipelineId 
     */
    getSubPipelineJobId(algSubPipelineId) {
        const jobId = ([...this._jobId2InternalIdMap].find(([, v]) => v === algSubPipelineId) || [])[0];
        return jobId;
    }
}

module.exports = new SubPipelineHandler();
