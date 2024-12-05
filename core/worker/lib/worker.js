const Logger = require('@hkube/logger');
const { pipelineStatuses, retryPolicy, taskStatuses } = require('@hkube/consts');
const stateManager = require('./states/stateManager');
const tracing = require('./tracing/tracing');
const jobConsumer = require('./consumer/JobConsumer');
const storageHelper = require('./storage/storage');
const algoRunnerCommunication = require('./algorithm-communication/workerCommunication');
const stateAdapter = require('./states/stateAdapter');
const { stateEvents, workerStates, workerCommands, logMessages, streamingEvents, Components } = require('./consts');
const kubernetes = require('./helpers/kubernetes');
const messages = require('./algorithm-communication/messages');
const streamHandler = require('./streaming/services/stream-handler');
const subPipeline = require('./code-api/subpipeline/subpipeline');
const execAlgorithms = require('./code-api/algorithm-execution/algorithm-execution');
const ALGORITHM_CONTAINER = 'algorunner';
const WORKER_CONTAINER = 'worker';
const component = Components.WORKER;
const { CONTAINER_STATUS } = kubernetes;
const DEFAULT_STOP_TIMEOUT = 5000;
let log;

class Worker {
    constructor() {
        this._stopTimeout = null;
        this._isConnected = false;
        this._isBootstrapped = false;
        this._ttlTimeoutHandle = null;
        this._stoppingTime = null;
        this._isScalingDown = false;
        this._inTerminationMode = false;
        this._shouldCheckAlgorithmStatus = true;
        this._shouldCheckSideCarStatus = undefined;
        this._algorunnerStatusFailAttempts = 0;
        this._sidecarStatusFailAttempts = undefined;
        this._checkAlgorithmStatus = this._checkAlgorithmStatus.bind(this);
        this._wrapperAlive = {};
    }

    preInit(options) {
        log = Logger.GetLogFromContainer();
        this._registerToConnectionEvents();
        this._options = options;
        this._podName = options.kubernetes.pod_name;
        this._devMode = options.devMode;
        this._servingReportInterval = options.servingReportInterval;
        this._stopTimeoutMs = options.timeouts.stop || DEFAULT_STOP_TIMEOUT;
        this._stoppingTimeoutMs = options.timeouts.stoppingTimeoutMs;
        this._wrapperAlive = { timeoutDuration: options.wrapperTimeoutDuration };
    }

    async init() {
        this._registerToCommunicationEvents();
        this._registerToStateEvents();
        this._registerToEtcdEvents();
        this._registerToAutoScalerChangesEvents();
        this._setInactiveTimeout();
        this._doTheBootstrap();
    }

    _initWrapperSettings(timeoutDuration) {
        this._wrapperAlive = {
            isRunning: false,
            timeoutDuration
        };
    }

    _initAlgorithmSettings() {
        const { storage: algorithmStorage, encoding: algorithmEncoding } = this._algorithmSettings;
        const storage = algorithmStorage || this._options.defaultStorageProtocol;
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
            jobConsumer.hotWorker = false;
            await jobConsumer.updateDiscovery({ state: stateManager.state });
            this._setInactiveTimeout();
        });
        stateAdapter.on(workerCommands.warmUp, async () => {
            jobConsumer.hotWorker = true;
            await jobConsumer.updateDiscovery({ state: stateManager.state });
            this._setInactiveTimeout();
        });
        stateAdapter.on(workerCommands.stopProcessing, async (data) => {
            const isPaused = jobConsumer.isConsumerPaused;
            const isServing = this._isAlgorithmServing();
            const shouldStop = !isPaused && !isServing;
            const paused = isPaused ? 'paused' : 'not paused';
            const serving = isServing ? 'serving' : 'not serving';
            const stop = shouldStop ? 'stop' : 'not stop';
            const reason = data.reason || '';
            log.info(`got stop processing, ${reason || ''} worker is ${paused} and ${serving} and therefore will ${stop}`, { component });

            if (shouldStop) {
                await jobConsumer.pause();
                await jobConsumer.updateDiscovery({ state: stateManager.state });
                this._setInactiveTimeout();
            }
        });
        stateAdapter.on(workerCommands.exit, async (event) => {
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
        stateAdapter.on(workerCommands.scaleDown, () => {
            this._scaleDown({ reason: workerCommands.scaleDown });
        });
    }

    async _scaleDown({ reason }) {
        if (this._isScalingDown) {
            return;
        }
        log.info(reason, { component });
        log.info('scaling down... stop algorithm and then exit', { component });
        const { jobId } = jobConsumer.jobData;
        if (jobId) {
            await this._stopAllPipelinesAndExecutions({ jobId, reason });
        }
        this._isScalingDown = true;
        stateManager.stop({ forceStop: false });
    }

    _registerToAutoScalerChangesEvents() {
        streamHandler.on(streamingEvents.DISCOVERY_CHANGED, (changes) => {
            log.info(`service discovery detected ${changes.length} changes`, { component });
            algoRunnerCommunication.send({
                command: messages.outgoing.serviceDiscoveryUpdate,
                data: changes
            });
        });
        streamHandler.on(streamingEvents.DISCOVERY_PARENTS_DOWN, () => {
            const reason = 'service discovery detected all parents down';
            this._scaleDown({ reason });
        });
        streamHandler.on(streamingEvents.METRICS_CHANGED, (metrics) => {
            jobConsumer.updateMetrics(metrics);
        });
    }

    _isAlgorithmServing() {
        const last = this._algorithmServingLastUpdate;
        return last && (Date.now() - last) < (this._servingReportInterval * 2);
    }

    async _stopPipeline({ status, reason, isTtlExpired }) {
        if (stateManager.state !== workerStates.working) {
            return;
        }
        const { jobId } = jobConsumer.jobData;
        log.warning(`got status: ${status}`, { component });
        await this._stopAllPipelinesAndExecutions({ jobId, reason: `parent pipeline ${status}. ${reason || ''}` });
        stateManager.stop({ isTtlExpired });
    }

    _doTheBootstrap() {
        if (!this._isConnected) {
            log.info('not connected yet', { component });
            this._checkAlgorithmStatus();
            return;
        }
        log.info('algorithm connected', { component });
        if (this._isBootstrapped) {
            if (this._devMode) {
                jobConsumer.isConnected = true;
            }
            return;
        }
        this._isBootstrapped = true;
        this._initAlgorithmSettings();
        log.debug('starting bootstrap state', { component });
        stateManager.bootstrap();
        jobConsumer.isConnected = true;
        log.debug('finished bootstrap state', { component });
    }

    /**
     * Checks the status of the algorithm container and all sidecar containers.
     * It processes each sidecar container, checks its status, and processes the algorithm container.
     * The method runs periodically based on the configured interval.
     *
     * @function _checkAlgorithmStatus
     * @memberof Worker
     * @returns {Promise<void>} A promise that resolves when all container statuses have been processed.
     */
    async _checkAlgorithmStatus() {
        log.info('entered _checkAlgorithmStatus', { component });
        if (!this._podName) return;
        let adir = 1;
        try {
            await this._processContainerStatus();
            adir = 2;
            const sideCars = await this._fetchAndInitializeSideCarStatus();
            adir = 3;
            await Promise.all(
                sideCars
                    .map((currSideCar, index) => ({ currSideCar, index }))
                    .filter(({ index }) => this._shouldCheckSideCarStatus[index])
                    .map(({ currSideCar, index }) => this._processContainerStatus(currSideCar, index))
            );
            adir = 4;
        }
        catch (e) {
            log.throttle.error(e.message, { component }, e);
            log.info(`WORKER LOGGING: message: ${e.message}`, { component });
        }
        finally {
            if (this._shouldCheckAlgorithmStatus && this._shouldCheckSideCarStatus.some(value => value)) {
                setTimeout(() => this._checkAlgorithmStatus(), this._options.checkAlgorithmStatusInterval);
            }
            log.info(`exited _checkAlgorithmStatus with phase ${adir}`, { component });
        }
    }

    /**
     * Fetches the list of sidecar container names for the given pod, and initializes
     * the status tracking arrays (`_shouldCheckSideCarStatus` and `_sidecarStatusFailAttempts`)
     * if they are not already initialized.
     *
     * @function _fetchAndInitializeSideCarStatus
     * @memberof Worker
     * @returns {Promise<Array<string>>} A promise that resolves to an array of sidecar container names.
     */
    async _fetchAndInitializeSideCarStatus() {
        const sideCars = (await kubernetes.getContainerNamesForPod(this._podName))
            .filter(name => name !== ALGORITHM_CONTAINER && name !== WORKER_CONTAINER);
        const { length } = sideCars;
        if (length > 0 && (!this._shouldCheckSideCarStatus || !this._sidecarStatusFailAttempts)) {
            this._shouldCheckSideCarStatus = new Array(length).fill(true);
            this._sidecarStatusFailAttempts = new Array(length).fill(0);
        }

        return sideCars;
    }

    /**
     * Processes the status of a given container (either a sidecar or the algorithm container).
     * If the container is running, the status is logged. If not, failure is handled based on the reason.
     *
     * @function _processContainerStatus
     * @memberof Worker
     * @param {string} [name] - The name of the container (defaults to `ALGORITHM_CONTAINER` for the algorithm container)
     * @param {number} [index] - The index of the sidecar container (not needed for the algorithm container)
     * @returns {Promise<void>} A promise that resolves when the container's status is processed
     */
    async _processContainerStatus(name, index) {
        const containerKind = name ? 'sidecar' : ALGORITHM_CONTAINER;
        log.info(`trying to check ${containerKind} container ${name} status`, { component });
        const containerStatus = await kubernetes.getPodContainerStatus(this._podName, name || ALGORITHM_CONTAINER) || {};
        const { status, reason, message } = containerStatus;
        if (status === CONTAINER_STATUS.RUNNING) {
            log.info(`${containerKind} ${name} status is ${status}`, { component });
            if (containerKind === ALGORITHM_CONTAINER) {
                this._shouldCheckAlgorithmStatus = false;
            }
            else {
                this._shouldCheckSideCarStatus[index] = false;
            }
        }
        else if (reason) {
            await this._handleContainerFailure(index, reason, message);
        }
    }

    /**
     * Handles the failure case for containers, specifically image pull errors.
     * If the failure attempts exceed 3, the job is terminated and no further checks are made.
     *
     * @function _handleContainerFailure
     * @memberof Worker
     * @param {number} index - The index of the sidecar container being checked (not needed for the algorithm container)
     * @param {string} reason - The reason for container failure
     * @param {string} message - The error message for the container failure
     * @returns {Promise<void>} A promise that resolves when the failure is handled
     */
    async _handleContainerFailure(index, reason, message) {
        const containerMessage = kubernetes.formatContainerMessage(reason);

        if (containerMessage.isImagePullErr) {
            let failAttemps;
            if (index >= 0) {
                this._sidecarStatusFailAttempts[index] += 1;
                failAttemps = this._sidecarStatusFailAttempts[index];
            }
            else {
                this._algorunnerStatusFailAttempts += 1;
                failAttemps = this._algorunnerStatusFailAttempts;
            }

            if (failAttemps > 3) {
                const options = {
                    error: {
                        message: `${message}. ${containerMessage.message}`,
                        isImagePullErr: true
                    }
                };
                log.error(options.error.message, { component });
                await this._endJob(options);
                this._shouldCheckAlgorithmStatus = false;
            }
        }
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
            this._isConnected = false;
            jobConsumer.isConnected = false;
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
        if (this._devMode) {
            return;
        }
        const type = jobConsumer.getAlgorithmType();
        const containerStatus = await kubernetes.waitForExitState(this._podName, ALGORITHM_CONTAINER);
        const container = containerStatus || {};
        const containerReason = container.reason;
        const workerState = stateManager.state;
        const containerMessage = Object.entries(container).map(([k, v]) => `${k}: ${v}`);
        const defaultMessage = `algorithm ${type} has disconnected while in ${workerState} state, reason: ${reason}.`;
        const errMessage = `${defaultMessage} ${containerMessage}`;
        const { message, isImagePullErr } = kubernetes.formatContainerMessage(containerReason);
        const options = {
            error: {
                message,
                isImagePullErr
            }
        };
        log.error(errMessage, { component });
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
        algoRunnerCommunication.on(messages.incomming.streamingStatistics, (message) => {
            streamHandler.reportStats(message.data);
        });
        algoRunnerCommunication.on(messages.incomming.done, (message) => {
            stateManager.done(message);
            this._handleWrapperIsAlive(false);
        });
        algoRunnerCommunication.on(messages.incomming.stopped, (message) => {
            this._handleWrapperIsAlive(false);
            if (this._stopTimeout) {
                clearTimeout(this._stopTimeout);
                this._stopTimeout = null;
            }
            if (this._isScalingDown) {
                const data = {
                    shouldCompleteJob: true
                };
                stateManager.exit(data);
            }
            else {
                stateManager.done(message);
            }
        });
        algoRunnerCommunication.on(messages.incomming.stopping, () => {
            this._handleWrapperIsAlive(false);
            const timeElapsed = Date.now() - this._stoppingTime > this._stoppingTimeoutMs;
            if (!timeElapsed) {
                if (this._stopTimeout) {
                    clearTimeout(this._stopTimeout);
                    this._stopTimeout = null;
                }
                this._stopTimeout = setTimeout(() => this._onStopTimeOut(), this._stopTimeoutMs);
            }
        });
        algoRunnerCommunication.on(messages.incomming.progress, (message) => {
            if (message.data) {
                log.debug(`progress: ${message.data.progress}`, { component });
            }
        });
        algoRunnerCommunication.on(messages.incomming.error, async (data) => {
            this._handleWrapperIsAlive(false);
            const message = data?.error?.message || 'unknown error';
            log.info(`got error from algorithm: ${message}`, { component });
            await this._handleRetry({ error: { message }, isAlgorithmError: true });
        });
        algoRunnerCommunication.on(messages.incomming.startSpan, (message) => {
            this._startAlgorithmSpan(message);
        });
        algoRunnerCommunication.on(messages.incomming.finishSpan, (message) => {
            this._finishAlgorithmSpan(message);
        });
        algoRunnerCommunication.on(messages.incomming.servingStatus, () => {
            this._algorithmServingLastUpdate = Date.now();
        });
        algoRunnerCommunication.on(messages.incomming.dataSourceRequest, async (message) => {
            let error;
            let response;
            const { requestId } = message.data;
            try {
                response = await stateAdapter.getDataSource(message.data);
            }
            catch (e) {
                error = e.message;
            }
            algoRunnerCommunication.send({
                command: messages.outgoing.dataSourceResponse,
                data: {
                    requestId,
                    response,
                    error
                },
            });
        });
        // Signal from wrapper indicating it's still running
        algoRunnerCommunication.on(messages.incomming.alive, () => {
            this._handleWrapperIsAlive(true);
        });
    }

    async _handleRetry(options) {
        const retry = jobConsumer.jobRetry;
        const { isAlgorithmError, isCrashed } = options;
        log.info(`starting retry policy from type ${retry.policy}`, { component });

        switch (retry.policy) {
            case retryPolicy.Never:
                await this._endJob(options);
                break;
            case retryPolicy.OnError:
                if (isAlgorithmError) {
                    await this._startRetry(options);
                    return;
                }
                await this._endJob(options);
                break;
            case retryPolicy.Always:
                await this._startRetry(options);
                break;
            case retryPolicy.OnCrash:
                if (isCrashed) {
                    await this._startRetry(options);
                    return;
                }
                await this._endJob(options, { retry: !isAlgorithmError });
                break;
            default:
                log.warning(`unknown retry policy ${retry.policy}`, { component });
                await this._endJob(options);
                break;
        }
    }

    async _endJob(options, { retry = true } = {}) {
        const { jobId } = jobConsumer.jobData;
        const reason = `parent algorithm failed: ${options.error.message}`;
        await this._stopAllPipelinesAndExecutions({ jobId, reason });

        const data = {
            ...options,
            shouldCompleteJob: true
        };
        if (retry) {
            stateManager.exit(data);
        }
        else {
            stateManager.done(data);
        }
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

    _validateWorkingState(operation) {
        if (stateManager.state === workerStates.working) {
            return true;
        }
        log.warning(`cannot ${operation} if not in working state`, { component });
        return false;
    }

    _startAlgorithmSpan(message) {
        if (!this._validateWorkingState('startSpan for algorithm')) {
            return;
        }
        const { data } = message;
        const { jobId, taskId } = jobConsumer;
        tracing.startAlgorithmSpan({ data, jobId, taskId });
    }

    _finishAlgorithmSpan(message) {
        if (!this._validateWorkingState('finishSpan for algorithm')) {
            return;
        }
        const { data } = message;
        const { taskId } = jobConsumer;
        tracing.finishAlgorithmSpan({ data, taskId });
    }

    async handleExit(code, jobId) {
        if (this._inTerminationMode) {
            return;
        }
        this._inTerminationMode = true;
        try {
            log.info(`starting termination mode. Exiting with code ${code}`, { component });
            await this._tryDeleteWorkerState();
            await this._stopAllPipelinesAndExecutions({ jobId, reason: 'parent pipeline exit' });
            let terminated = false;
            if (this._isConnected) {
                this._tryToSendCommand({ command: messages.outgoing.exit, data: { exitCode: 0 } });
                terminated = await kubernetes.waitForTerminatedState(this._podName, ALGORITHM_CONTAINER);
            }
            if (terminated) {
                log.info(`algorithm container terminated. Exiting with code ${code}`, { component });
            }
            else { // if not terminated, kill job
                const jobName = await kubernetes.getJobForPod(this._podName);
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
            algoRunnerCommunication.send(message);
        }
        catch (err) {
            log.warning(`Failed to send command ${message.command}`, { component });
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

    /**
     * Sets or resets a timeout to check if the wrapper is still alive.
     * The timeout duration is defined by `this._wrapperAlive.inactiveTimer`.
     */
    _handleWrapperIsAlive(isRunning) {
        if (isRunning) {
            if (this._wrapperAlive.inactiveTimer) {
                clearTimeout(this._wrapperAlive.inactiveTimer);
            }
            this._wrapperAlive.inactiveTimer = setTimeout(() => {
                log.error(`No response from wrapper for more than ${this._wrapperAlive.timeoutDuration / 1000} seconds.`, { component });
                stateManager.error();
            }, this._wrapperAlive.timeoutDuration);
        }
        else if (this._wrapperAlive.inactiveTimer) {
            clearTimeout(this._wrapperAlive.inactiveTimer);
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
        stateManager.on(stateEvents.stateEntered, async ({ job, state, results, isTtlExpired, forceStop, stopInvoked }) => {
            const { jobId } = jobConsumer.jobData;
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
                    await jobConsumer.finishJob(result, isTtlExpired, stopInvoked);
                    pendingTransition = this._isConnected && stateManager.cleanup.bind(stateManager);
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
                        this._wrapperAlive.isRunning = true;
                        this._handleWrapperIsAlive();
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
                    if (!this._stopTimeout) {
                        this._stoppingTime = Date.now();
                        this._handleTtlEnd();
                        this._stopTimeout = setTimeout(() => this._onStopTimeOut(), this._stopTimeoutMs);
                        algoRunnerCommunication.send({
                            command: messages.outgoing.stop, data: { forceStop }
                        });
                    }
                    break;
                default:
            }
            await jobConsumer.updateDiscovery(result);
            if (pendingTransition) {
                pendingTransition();
            }
        });
    }

    _onStopTimeOut() {
        const { jobId } = jobConsumer.jobData;
        const warn = 'Timeout exceeded trying to stop algorithm';
        log.warning(warn, { component });
        stateManager.done(warn);
        this.handleExit(0, jobId);
    }
}

module.exports = new Worker();
