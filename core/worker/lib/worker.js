const Logger = require('@hkube/logger');
const { tracer } = require('@hkube/metrics');
const { pipelineStatuses, retryPolicy, taskStatuses } = require('@hkube/consts');
const stateManager = require('./states/stateManager');
const jobConsumer = require('./consumer/JobConsumer');
const algoRunnerCommunication = require('./algorithm-communication/workerCommunication');
const discovery = require('./states/discovery');
const { stateEvents, workerStates, workerCommands, Components, jobStatus, protocols } = require('../lib/consts');
const kubernetes = require('./helpers/kubernetes');
const messages = require('./algorithm-communication/messages');
const subPipeline = require('./code-api/subpipeline/subpipeline');
const execAlgorithms = require('./code-api/algorithm-execution/algorithm-execution');
const encodingHelper = require('./helpers/encoding');
const { logMessages } = require('./consts');
const ALGORITHM_CONTAINER = 'algorunner';
const { EncodingProtocols, StorageProtocols, DefaultEncodingProtocol, DefaultStorageProtocol } = protocols;
const component = Components.WORKER;
const DEFAULT_STOP_TIMEOUT = 5000;
let log;

class Worker {
    constructor() {
        this._stopTimeout = null;
        this._isConnected = false;
        this._isInit = false;
        this._isBootstrapped = false;
        this._ttlTimeoutHandle = null;
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
        this._isInit = true;
        this._doTheBootstrap();
    }

    _initAlgorithmSettings() {
        const isBinary = this._options.workerCommunication.config.binary;
        const workerEncodingProtocol = isBinary ? EncodingProtocols.BSON : DefaultEncodingProtocol;
        const workerStorageProtocol = StorageProtocols.BY_REF;
        const storageProtocols = this._algorithmSettings.storageProtocols || DefaultStorageProtocol;
        const encodingProtocols = this._algorithmSettings.encodingProtocols || DefaultEncodingProtocol;

        const storage = this._resolveConfig(storageProtocols, workerStorageProtocol, DefaultStorageProtocol);
        const encoding = this._resolveConfig(encodingProtocols, workerEncodingProtocol, DefaultEncodingProtocol);
        jobConsumer.setStorage(storage);
        encodingHelper.setEncoding(encoding);
    }

    _resolveConfig(algorithmProtocols, workerProtocol, defaultVal) {
        const algorithmProtocolsArray = algorithmProtocols.split(',');
        const value = algorithmProtocolsArray.includes(workerProtocol) ? workerProtocol : defaultVal;
        return value;
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
        discovery.on(pipelineStatuses.COMPLETED, (data) => {
            this._stopPipeline({ status: data.status });
        });
        discovery.on(pipelineStatuses.FAILED, (data) => {
            this._stopPipeline({ status: data.status });
        });
        discovery.on(pipelineStatuses.STOPPED, (data) => {
            this._stopPipeline({ status: data.status, reason: data.reason });
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
        discovery.on(workerCommands.exit, async (event) => {
            log.info(`got ${event.status.command} command, message ${event.message}`, { component });
            await jobConsumer.updateDiscovery({ state: 'exit' });
            const data = {
                error: {
                    message: event.message
                },
                shouldCompleteJob: true
            };
            stateManager.exit(data);
        });
        discovery.on(workerCommands.startProcessing, async () => {
            if (stateManager.state === workerStates.exit) {
                return;
            }
            if (jobConsumer.isConsumerPaused) {
                this._clearInactiveTimeout();
                await jobConsumer.resume();
                await jobConsumer.updateDiscovery({ state: stateManager.state });
                this._setInactiveTimeout();
            }
        });
    }

    async _stopPipeline({ status, reason, isTtlExpired }) {
        if (stateManager.state !== workerStates.working) {
            return;
        }
        const { jobId } = jobConsumer.jobData;
        log.warning(`got status: ${status}`, { component });
        await this._stopAllPipelinesAndExecutions({ jobId, reason: `parent pipeline ${status}. ${reason || ''}` });
        stateManager.stop(isTtlExpired);
    }

    _doTheBootstrap() {
        if (!this._isConnected) {
            log.info('not connected yet', { component });
            return;
        }
        if (!this._isInit) {
            log.info('not init yet', { component });
            return;
        }
        if (this._isBootstrapped) {
            log.info('already bootstrapped', { component });
            return;
        }
        this._isBootstrapped = true;
        this._initAlgorithmSettings();
        log.info('starting bootstrap state', { component });
        stateManager.bootstrap();
        log.info('finished bootstrap state', { component });
    }

    _registerToConnectionEvents() {
        algoRunnerCommunication.on('connection', (options) => {
            this._isConnected = true;
            if (stateManager.state === workerStates.exit) {
                return;
            }
            this._algorithmSettings = options || {};
            this._doTheBootstrap();
        });
        algoRunnerCommunication.on('disconnect', async (reason) => {
            if (stateManager.state === workerStates.exit) {
                return;
            }
            await this._algorithmDisconnect(reason);
        });

        stateManager.on('disconnect', async (reason) => {
            await this._algorithmDisconnect(reason);
        });
    }

    async _algorithmDisconnect(reason) {
        if (this._debugMode) {
            return;
        }
        const type = jobConsumer.getAlgorithmType();
        const containerStatus = await kubernetes.waitForExitState(this._options.kubernetes.pod_name, ALGORITHM_CONTAINER);
        const container = containerStatus || {};
        const containerReason = container.reason || '';
        const workerState = stateManager.state;
        const containerMessage = Object.entries(container).map(([k, v]) => `${k}: ${v}`);
        const defaultMessage = `algorithm ${type} has disconnected while in ${workerState} state, reason: ${reason}.`;
        const options = {
            error: {
                reason: containerReason,
                message: `${defaultMessage} ${containerMessage}`,
            }
        };
        const error = options.error.message;
        log.error(error, { component });
        await this._handleRetry({ ...options, isCrashed: true });
    }

    /**
     * Register to algoRunner messages.
     */
    _registerToCommunicationEvents() {
        algoRunnerCommunication.on(messages.incomming.initialized, () => {
            stateManager.start();
        });
        algoRunnerCommunication.on(messages.incomming.storing, async (message) => {
            await jobConsumer.updateStatus({ status: jobStatus.JOB_STATUS.STORING, ...message.data });
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
        algoRunnerCommunication.on(messages.incomming.error, async (data) => {
            const message = data.error && data.error.message;
            log.info(`got error from algorithm: ${message}`, { component });
            await this._handleRetry({ error: { message }, isAlgorithmError: true });
        });
        algoRunnerCommunication.on(messages.incomming.startSpan, (message) => {
            this._startAlgorithmSpan(message);
        });
        algoRunnerCommunication.on(messages.incomming.finishSpan, (message) => {
            this._finishAlgorithmSpan(message);
        });
    }

    async _handleRetry(options) {
        const retry = jobConsumer.jobRetry;
        const { isAlgorithmError, isCrashed } = options;

        switch (retry.policy) {
            case retryPolicy.Never:
                this._endJob(options);
                break;
            case retryPolicy.OnError:
                if (isAlgorithmError) {
                    this._startRetry(options);
                    return;
                }
                this._endJob(options);
                break;
            case retryPolicy.Always:
                this._startRetry(options);
                break;
            case retryPolicy.OnCrash:
                if (isCrashed) {
                    this._startRetry(options);
                    return;
                }
                this._endJob(options);
                break;
            default:
                log.warning(`unknown retry policy ${retry.policy}`, { component });
                this._endJob(options);
                break;
        }
    }

    async _endJob(options) {
        const { jobId } = jobConsumer.jobData;
        const reason = `parent algorithm failed: ${options.error.message}`;
        await this._stopAllPipelinesAndExecutions({ jobId, reason });

        const data = {
            ...options,
            shouldCompleteJob: true
        };
        stateManager.done(data);
    }

    async _startRetry(options) {
        const data = {
            ...options,
            shouldCompleteJob: false
        };
        await jobConsumer.sendWarning(options.error.message);
        stateManager.exit(data);
    }

    async _stopAllPipelinesAndExecutions({ jobId, reason }) {
        await Promise.all([
            subPipeline.stopAllSubPipelines({ reason }),
            execAlgorithms.stopAllExecutions({ jobId })
        ]);
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
            log.warning(`invalid startSpan message: ${JSON.stringify(message, null, 2)}`);
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
                //         log.warning('temp log message: no top span in start alg span');
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
            log.warning(`invalid finishSpan message: ${JSON.stringify(message, null, 2)}`);
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

    async handleExit(code, jobId) {
        if (!this._inTerminationMode) {
            this._inTerminationMode = true;
            try {
                log.info(`starting termination mode. Exiting with code ${code}`, { component });
                await this._tryDeleteWorkerState();
                await this._stopAllPipelinesAndExecutions({ jobId, reason: 'parent pipeline exit' });

                this._tryToSendCommand({ command: messages.outgoing.exit });
                const terminated = await kubernetes.waitForTerminatedState(this._options.kubernetes.pod_name, ALGORITHM_CONTAINER);
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
                log.warning(`failed to handle exit: ${error}`, { component });
            }
            finally {
                this._inTerminationMode = false;
                process.exit(code);
            }
        }
    }

    _tryDeleteWorkerState() {
        try {
            return discovery.deleteWorkerState();
        }
        catch (err) {
            log.warning(`Failed to delete worker states ${err}`, { component });
            return err;
        }
    }

    _tryToSendCommand(message) {
        try {
            return algoRunnerCommunication.send(message);
        }
        catch (err) {
            log.warning(`Failed to send command ${message.command}`, { component });
            return err;
        }
    }

    _handleTtlStart(job) {
        const { ttl } = job.data;
        if (ttl) {
            this._ttlTimeoutHandle = setTimeout(async () => {
                const msg = logMessages.algorithmTtlExpired;
                log.warning(msg, { component });
                await this._stopPipeline({ status: taskStatuses.STOPPED, reason: msg, isTtlExpired: true });
            }, ttl * 1000);
        }
    }

    _handleTtlEnd() {
        if (this._ttlTimeoutHandle) {
            clearTimeout(this._ttlTimeoutHandle);
            this._ttlTimeoutHandle = null;
        }
    }

    _handleTimeout(state) {
        if (state === workerStates.ready) {
            this._clearInactiveTimeout();
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

    _clearInactiveTimeout() {
        if (this._inactiveTimer) {
            clearTimeout(this._inactiveTimer);
            this._inactiveTimer = null;
        }
    }

    _registerToStateEvents() {
        stateManager.on(stateEvents.stateEntered, async ({ job, state, results, isTtlExpired }) => {
            const { jobId } = jobConsumer.jobData || {};
            let pendingTransition = null;
            let reason = null;
            log.info(`Entering state: ${state}`, { component });
            const result = { state, results };
            this._handleTimeout(state);
            switch (state) {
                case workerStates.exit:
                    this._handleTtlEnd();
                    await jobConsumer.pause();
                    await jobConsumer.finishJob(result);
                    jobConsumer.finishBullJob(results);
                    this.handleExit(0, jobId);
                    break;
                case workerStates.results:
                    this._handleTtlEnd();
                    reason = `parent algorithm entered state ${state}`;
                    await this._stopAllPipelinesAndExecutions({ jobId, reason });
                    await jobConsumer.finishJob(result, isTtlExpired);
                    pendingTransition = stateManager.cleanup.bind(stateManager);
                    break;
                case workerStates.ready:
                    break;
                case workerStates.init: {
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
                    this._handleTtlStart(job);
                    algoRunnerCommunication.send({
                        command: messages.outgoing.start
                    });
                    break;
                case workerStates.shutdown:
                    break;
                case workerStates.error:
                    break;
                case workerStates.stop:
                    this._handleTtlEnd();
                    this._stopTimeout = setTimeout(() => {
                        log.warning('Timeout exceeded trying to stop algorithm.', { component });
                        stateManager.done('Timeout exceeded trying to stop algorithm');
                        this.handleExit(0, jobId);
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
