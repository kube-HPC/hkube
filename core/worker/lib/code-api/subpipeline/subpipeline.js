const Logger = require('@hkube/logger');
const Validator = require('ajv');
const { tracer } = require('@hkube/metrics');
const { pipelineStatuses } = require('@hkube/consts');
const algoRunnerCommunication = require('../../algorithm-communication/workerCommunication');
const stateAdapter = require('../../states/stateAdapter');
const messages = require('../../algorithm-communication/messages');
const { EventMessages, ApiServerPostTypes, workerStates, Components } = require('../../consts');
const apiServerClient = require('../../helpers/api-server-client');
const jobConsumer = require('../../consumer/JobConsumer');
const stateManager = require('../../states/stateManager');
const { startSubPipeline, stopSubPipeline } = require('./schema');
const validator = new Validator({ useDefaults: true, coerceTypes: false });
const component = Components.WORKER;
let log;

class SubPipelineHandler {
    init() {
        log = Logger.GetLogFromContainer();
        // sub-pipeline IDs mapping: jobId => internal sub-pipeline
        this._jobId2InternalIdMap = new Map();
        this._stoppingSubpipelines = false;
        this._startSubPipelineSchema = validator.compile(startSubPipeline);
        this._stopSubPipelineSchema = validator.compile(stopSubPipeline);
        this._registerToEtcdEvents();
        this._registerToAlgEvents();
    }

    setStorageType(type) {
        const subpipeline = require(`./subpipeline-${type}`); // eslint-disable-line
        this._getStorage = (...args) => subpipeline.getResultFromStorage(...args);
    }

    _registerToEtcdEvents() {
        stateAdapter.on(`${EventMessages.JOB_RESULT}-${pipelineStatuses.COMPLETED}`, (result) => {
            const subPipeline = this._getAndCleanAlgSubPipelineId(result);
            if (subPipeline) {
                this._handleSubPipelineCompleted(result, subPipeline);
            }
        });
        stateAdapter.on(`${EventMessages.JOB_RESULT}-${pipelineStatuses.STOPPED}`, (result) => {
            const subPipeline = this._getAndCleanAlgSubPipelineId(result);
            if (subPipeline) {
                this._handleSubPipelineStopped(result, subPipeline);
            }
        });
        stateAdapter.on(`${EventMessages.JOB_RESULT}-${pipelineStatuses.FAILED}`, (result) => {
            const subPipeline = this._getAndCleanAlgSubPipelineId(result);
            if (!this._validateWorkingState('send subPipelineError') || !subPipeline) {
                return;
            }
            const { subPipelineId } = subPipeline;
            const err = (result.error && result.error.message) || result.error || 'subpipeline job failed';
            this._finishSubPipelineSpan(subPipelineId, pipelineStatuses.FAILED, err);
            this._handleJobError(err, subPipelineId);
        });
    }

    _registerToAlgEvents() {
        algoRunnerCommunication.on(messages.incomming.startRawSubPipeline, (message) => {
            this._handleStartSubPipeline(message, ApiServerPostTypes.SubPipeline.RAW);
        });
        algoRunnerCommunication.on(messages.incomming.startStoredSubPipeline, (message) => {
            this._handleStartSubPipeline(message, ApiServerPostTypes.SubPipeline.STORED);
        });
        algoRunnerCommunication.on(messages.incomming.stopSubPipeline, (message) => {
            this._handleStopSubPipeline(message);
        });
    }

    /**
     * Delete jobId/subPipelineId mapping and unwatch subpipeline job results.
     * @param {object} result
     * @returns {string} alg subPipelineId (correlates to result.jobId)
     */
    _getAndCleanAlgSubPipelineId(result) {
        const subPipeline = this._jobId2InternalIdMap.get(result.jobId);
        if (!subPipeline) {
            log.warning(`got result with unknown jobId: ${result.jobId}`, { component });
            return null;
        }
        log.info(`got subPipeline result, status=${result.status}, jobId: ${result.jobId}, alg subPipelineId: ${subPipeline.subPipelineId}`, { component });
        this._jobId2InternalIdMap.delete(result.jobId);
        this.unwatchJobResults(result.jobId);
        return subPipeline;
    }

    /**
     * Unwatch subPipeline job results
     * @param {string} subPipelineJobId
     */
    async unwatchJobResults(subPipelineJobId) {
        try {
            await stateAdapter.unWatchJobResults({ jobId: subPipelineJobId });
        }
        catch (error) {
            log.warning(`error during unWatchJobResults for jobId: ${subPipelineJobId}: ${error.message}`, { component });
        }
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
        const err = `cannot ${operation} while in ${stateManager.state} state`;
        log.warning(err, { component });
        return false;
    }

    /**
     * Handle subPipeline completed
     * @param {object} result
     * @param {string} subPipelineId
     */
    async _handleSubPipelineCompleted(result, subPipeline) {
        const { subPipelineId, includeResult } = subPipeline;
        log.info(`SubPipeline job completed, alg subPipelineId: ${subPipelineId}`, { component });
        this._finishSubPipelineSpan(subPipelineId, result.status);
        if (!this._validateWorkingState('send subPipelineDone')) {
            return;
        }
        // get subpipeline results from storage
        try {
            const response = await this._getStorage({ result: result.data, includeResult });
            algoRunnerCommunication.send({
                command: messages.outgoing.subPipelineDone,
                data: {
                    response,
                    subPipelineId
                }
            });
        }
        catch (error) {
            this._handleJobError(error.message, subPipelineId);
        }
    }

    /**
     * Handle subPipeline stopped
     * @param {object} result
     * @param {string} subPipelineId
     */
    _handleSubPipelineStopped(result, subPipeline) {
        const { subPipelineId } = subPipeline;
        log.warning(`SubPipeline job stopped - send subPipelineStopped to alg, alg subPipelineId: ${subPipelineId} `, { component });
        this._finishSubPipelineSpan(subPipelineId, result.status, result.reason);
        if (!this._validateWorkingState('send subPipelineStopped')) {
            return;
        }
        algoRunnerCommunication.send({
            command: messages.outgoing.subPipelineStopped,
            data: {
                subPipelineId,
                reason: result.reason
            }
        });
    }

    /**
     * Handle subPipeline job error
     * @param {string} error error message
     * @param {string} subPipelineId internal algorithm subpipeline Id
     */
    async _handleJobError(error, subPipelineId) {
        log.error(`SubPipeline job error: ${error}, alg subPipelineId: ${subPipelineId}`, { component });
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
        let subPipelineId;
        try {
            const data = (message && message.data) || {};
            const valid = this._stopSubPipelineSchema(data);
            if (!valid || !this._validateWorkingState('stop subPipeline')) {
                throw new Error(validator.errorsText(this._stopSubPipelineSchema.errors));
            }
            subPipelineId = data.subPipelineId; // eslint-disable-line
            const subPipelineJobId = this.getSubPipelineJobId(subPipelineId);
            log.info(`got stopSubPipeline for alg subPipelineId ${subPipelineId} - subPipeline jobId: ${subPipelineJobId}`, { component });

            if (!subPipelineJobId) {
                log.warning(`ignore stopSubPipeline: alg subPipelineId ${subPipelineId} not found`, { component });
                throw new Error(`cannot stop subPipeline - not found: ${subPipelineId}`);
            }
            const reason = `stopped by algorithm: ${data.reason}`;
            this._stopSubPipeline(subPipelineJobId, reason);
        }
        catch (e) {
            this._handleJobError(e.message, subPipelineId);
        }
    }

    /**
     * Start subpipeline span for algorithm
     * @param subPipelineName subPipeline name
     * @param subPipelineId subpipeline internal algorithm id
     * @param subPipelineJobId subPipeline jobId in hkube
     */
    _startSubPipelineSpan(subPipelineName, subPipelineId) {
        try {
            const name = `subpipeline ${subPipelineName} start invoked`;
            const spanOptions = {
                name,
                id: subPipelineId,
                tags: {
                    subPipelineId,
                    jobId: jobConsumer.jobId,
                    taskId: jobConsumer.taskId
                }
            };

            const topWorkerSpan = tracer.topSpan(jobConsumer.taskId);
            if (topWorkerSpan) {
                spanOptions.parent = topWorkerSpan.context();
            }
            else {
                // log.warning('temp log message: no top span in start sub pipeline span');
                spanOptions.parent = jobConsumer._job.data.spanId;
            }
            tracer.startSpan(spanOptions);
        }
        catch (error) {
            log.warning(`error while staring subpipeline span: ${error.message}`);
        }
    }

    /**
     * finish subPipeline span for algorithm
     * @param subPipelineId
     * @param status subPipeline status when finished
     * @param error for status=FAILED: error object or message, for status=STOP: stop reason
     */
    _finishSubPipelineSpan(subPipelineId, status, error) {
        const topSpan = tracer.topSpan(subPipelineId);
        if (topSpan) {
            topSpan.addTag({ status });
            if (status === pipelineStatuses.STOPPED) {
                topSpan.addTag({ reason: error });
                topSpan.finish();
            }
            else {
                topSpan.finish(error);
            }
        }
    }

    /**
     * Handle algorithm request to start a sub pipeline.
     * @param {object} message message
     * @param {string} subPipelineType
     */
    async _handleStartSubPipeline(message, subPipelineType) {
        let subPipelineId;
        try {
            const data = (message && message.data) || {};
            const valid = this._startSubPipelineSchema(data);
            if (!valid || !this._validateWorkingState('start subPipeline')) {
                throw new Error(validator.errorsText(this._startSubPipelineSchema.errors));
            }
            subPipelineId = data.subPipelineId; // eslint-disable-line
            const { subPipeline, includeResult } = data;
            log.info(`got startSubPipeline ${subPipeline.name} from algorithm`, { component });
            this._startSubPipelineSpan(subPipeline.name, subPipelineId);

            algoRunnerCommunication.send({
                command: messages.outgoing.subPipelineStarted,
                data: {
                    subPipelineId
                }
            });

            // post subPipeline
            const { jobId, taskId } = jobConsumer;
            const { rootJobId } = jobConsumer._job.data.info;
            const subPipelineToPost = { ...subPipeline, jobId, taskId, rootJobId }; // add jobId, taskId
            const response = await apiServerClient.postSubPipeline(subPipelineToPost, subPipelineType, subPipelineId);
            if (response) {
                const subPipelineJobId = response.jobId;
                this._jobId2InternalIdMap.set(subPipelineJobId, { subPipelineId, includeResult });
                log.info(`SubPipeline posted, alg subPipelineId=${subPipelineId}, jobId=${subPipelineJobId}`, { component });
                const sbInvokedTrace = tracer.topSpan(subPipelineId);
                sbInvokedTrace.addTag({ subPipelineJobId });
                await stateAdapter.watchJobResults({ jobId: subPipelineJobId });
            }
            else {
                throw new Error('post subPipeline got no response');
            }
        }
        catch (e) {
            const errorMessage = (e.error && e.error.error && e.error.error.message) || (e.error && e.error.message) || (e.message);
            this._handleJobError(errorMessage, subPipelineId);
        }
    }

    /**
     * Stop a single subPipeline
     * @param {string} subPipelineJobId
     * @param {string} reason
     */
    async _stopSubPipeline(subPipelineJobId, reason) {
        log.info(`stopping subPipeline  ${subPipelineJobId} - reason: ${reason} ...`);
        try {
            await this.unwatchJobResults(subPipelineJobId);
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
    async stopAllSubPipelines({ reason }) {
        if (this._stoppingSubpipelines) {
            return;
        }
        if (this._jobId2InternalIdMap.size === 0) {
            log.info('no registered subPipelines to stop', { component });
            return;
        }
        this._stoppingSubpipelines = true;
        try {
            await Promise.all([...this._jobId2InternalIdMap].map(s => this._closeSubpipeline(s, reason)));
        }
        catch (error) {
            log.warning(`failed to stop subPipeline: ${error}`, { component });
        }

        // clean subPipelines IDs
        this._jobId2InternalIdMap.clear();
        this._stoppingSubpipelines = false;
    }

    async _closeSubpipeline(subPipelineIdEntry, reason) {
        const [subPipelineJobId, subPipeline] = subPipelineIdEntry;
        const { subPipelineId } = subPipeline;
        await this._stopSubPipeline(subPipelineJobId, reason);
        this._jobId2InternalIdMap.delete(subPipelineJobId);
        this._finishSubPipelineSpan(subPipelineId, pipelineStatuses.STOPPED, reason);
    }

    /**
     * Get subPipeline jobId by alg subPipelineId
     * @param {*} algSubPipelineId
     */
    getSubPipelineJobId(algSubPipelineId) {
        const jobId = ([...this._jobId2InternalIdMap].find(([, v]) => v.subPipelineId === algSubPipelineId) || [])[0];
        return jobId;
    }
}

module.exports = new SubPipelineHandler();
