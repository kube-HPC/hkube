const Logger = require('@hkube/logger');
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
        discovery.on(EventMessages.STOP, (res) => {
            log.info(`got stop: ${res.reason}`, { component });
            // stop registered subpipelines first
            const reason = `parent pipeline stopped: ${res.reason}`;
            subpieline.stopAllSubPipelines(reason);
            // then stop worker
            stateManager.stop();
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
        algoRunnerCommunication.on('disconnect', (reason) => {
            if (stateManager.state === workerStates.exit) {
                return;
            }
            log.warning(`algorithm runner has disconnected, reason: ${reason}`, { component });
            if (!this._debugMode) {
                const type = jobConsumer.getAlgorithmType();
                const message = {
                    command: 'errorMessage',
                    error: {
                        code: 'Failed',
                        message: `algorithm ${type} has disconnected, reason: ${reason}`
                    }
                };
                stateManager.done(message);
            }
        });
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
        algoRunnerCommunication.on(messages.incomming.error, (message) => {
            log.error(`got error from algorithm. Error: ${JSON.stringify(message, 2, null)}`, { component });
            stateManager.done(message);
        });
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

                // clean all registered subPiplines, if exist
                const reason = 'parent pipeline exit';
                subpieline.stopAllSubPipelines(reason);
            }
            catch (error) {
                log.error(`failed to handle exit: ${error}`, { component });
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
        if (state === workerStates.ready || state === workerStates.exit) {
            if (this._inactiveTimer) {
                clearTimeout(this._inactiveTimer);
                this._inactiveTimer = null;
            }
            if (this._inactiveTimeoutMs != 0) { // eslint-disable-line
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
                    reason = `parent pipeline entered state ${state}`;
                    subpieline.stopAllSubPipelines(reason);
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
