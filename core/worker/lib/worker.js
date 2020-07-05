const Logger = require('@hkube/logger');
const { pipelineStatuses, retryPolicy, taskStatuses } = require('@hkube/consts');
const stateManager = require('./states/stateManager');
const tracing = require('./tracing/tracing');
const jobConsumer = require('./consumer/JobConsumer');
const storageHelper = require('./storage/storage');
const algoRunnerCommunication = require('./algorithm-communication/workerCommunication');
const stateAdapter = require('./states/stateAdapter');
const { stateEvents, workerStates, workerCommands, Components } = require('./consts');
const kubernetes = require('./helpers/kubernetes');
const messages = require('./algorithm-communication/messages');
const subPipeline = require('./code-api/subpipeline/subpipeline');
const execAlgorithms = require('./code-api/algorithm-execution/algorithm-execution');
const { logMessages } = require('./consts');
const ALGORITHM_CONTAINER = 'algorunner';
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
        this._devMode = options.devMode;
        this._registerToCommunicationEvents();
        this._registerToStateEvents();
        this._registerToEtcdEvents();
        this._stopTimeoutMs = options.timeouts.stop || DEFAULT_STOP_TIMEOUT;
        this._setInactiveTimeout();
        this._isInit = true;
        this._doTheBootstrap();
    }

    _initAlgorithmSettings() {
        const { storage: algorithmStorage, encoding: algorithmEncoding } = this._algorithmSettings;

        const storage = (!this._debugMode && algorithmStorage) || this._options.defaultStorageProtocol;
        const encoding = algorithmEncoding || this._options.defaultWorkerAlgorithmEncoding;
        storageHelper.setStorageType(storage);
        execAlgorithms.setStorageType(storage);
        subPipeline.setStorageType(storage);
        algoRunnerCommunication.setEncodingType(encoding);

        let message = 'algorithm protocols: none';
        if (algorithmStorage && algorithmEncoding) {
            message = `algorithm protocols: ${this._formatProtocol({ storage: algorithmStorage, encoding: algorithmEncoding })}`;
        }
        log.info(`${message}. chosen protocols: ${this._formatProtocol({ storage, encoding })}`, { component });
    }

    _formatProtocol(protocols) {
        return Object.keys(protocols).length > 0 ? Object.entries(protocols).map(([k, v]) => `${k}:${v}`).join(',') : '';
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
        stateAdapter.on(pipelineStatuses.COMPLETED, (data) => {
            this._stopPipeline({ status: data.status });
        });
        stateAdapter.on(pipelineStatuses.FAILED, (data) => {
            this._stopPipeline({ status: data.status });
        });
        stateAdapter.on(pipelineStatuses.STOPPED, (data) => {
            this._stopPipeline({ status: data.status, reason: data.reason });
        });
        stateAdapter.on(workerCommands.coolDown, async () => {
            log.info('got coolDown event', { component });
            jobConsumer.hotWorker = false;
            await jobConsumer.updateDiscovery({ state: stateManager.state });
            this._setInactiveTimeout();
        });
        stateAdapter.on(workerCommands.warmUp, async () => {
            log.info('got warmUp event', { component });
            jobConsumer.hotWorker = true;
            await jobConsumer.updateDiscovery({ state: stateManager.state });
            this._setInactiveTimeout();
        });
        stateAdapter.on(workerCommands.stopProcessing, async () => {
            if (!jobConsumer.isConsumerPaused) {
                await jobConsumer.pause();
                await jobConsumer.updateDiscovery({ state: stateManager.state });
                this._setInactiveTimeout();
            }
        });
        stateAdapter.on(workerCommands.exit, async (event) => {
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
        stateAdapter.on(workerCommands.startProcessing, async () => {
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
            this._isConnected = false;
            this._isBootstrapped = false;
            await this._algorithmDisconnect(reason);
        });
    }

    async _algorithmDisconnect(reason) {
        if (this._debugMode) {
            stateManager.done({ error: { message: `algorithm has disconnected ${reason}` } });
            return;
        }
        if (this._devMode) {
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
        algoRunnerCommunication.on(messages.incomming.storing, (message) => {
            jobConsumer.setStoringStatus(message.data);
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
        const { jobId, taskId } = jobConsumer;
        tracing.startAlgorithmSpan({ data, jobId, taskId });
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
        const { taskId } = jobConsumer;
        tracing.finishAlgorithmSpan({ data, taskId });
    }

    async handleExit(code, jobId) {
        if (this._debugMode || this._inTerminationMode) {
            return;
        }
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

    _tryDeleteWorkerState() {
        try {
            return stateAdapter.deleteWorkerState();
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
        if (this._debugMode) {
            return;
        }
        if (state === workerStates.ready) {
            this._clearInactiveTimeout();
            if (!jobConsumer.hotWorker && this._inactiveTimeoutMs != 0) { // eslint-disable-line
                log.info(`starting inactive timeout for worker ${this._inactiveTimeoutMs / 1000} seconds`, { component });
                this._inactiveTimer = setTimeout(() => {
                    if (!this._inTerminationMode) {
                        log.info(`worker is inactive for more than ${this._inactiveTimeoutMs / 1000} seconds.`, { component });
                        stateManager.exit({ shouldCompleteJob: false });
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
                    const { error, data } = await storageHelper.extractData(job.data);
                    if (!error) {
                        const spanId = tracing.getTopSpan(jobConsumer.taskId) || jobConsumer._job.data.spanId;

                        algoRunnerCommunication.send({
                            command: messages.outgoing.initialize,
                            data: { ...data, spanId }
                        });
                    }
                    break;
                }
                case workerStates.working: {
                    this._handleTtlStart(job);
                    const spanId = tracing.getTopSpan(jobConsumer.taskId) || jobConsumer._job.data.spanId;
                    algoRunnerCommunication.send({
                        command: messages.outgoing.start,
                        data: { spanId }
                    });
                    break;
                }
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
