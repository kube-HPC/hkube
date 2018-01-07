
const stateManager = require('./states/stateManager');
const jobConsumer = require('./consumer/JobConsumer');
const algoRunnerCommunication = require('./algorunnerCommunication/workerCommunication');
const discovery = require('./states/discovery');
const Logger = require('@hkube/logger');
let log;
const { stateEvents } = require('../common/consts/events');
const { workerStates } = require('../common/consts/states');
const messages = require('./algorunnerCommunication/messages');
const DEFAULT_STOP_TIMEOUT = 5000;
class Worker {
    constructor() {
        this._stopTimeout = null;
    }

    async init(options) {
        log = Logger.GetLogFromContainer();
        this._registerToCommunicationEvents();
        this._registerToStateEvents();
        this._registerToEtcdEvents();
        this._stopTimeoutMs = options.timeouts.stop || DEFAULT_STOP_TIMEOUT;
    }

    _registerToEtcdEvents() {
        discovery.on('stop', (res) => {
            log.info(`got stop for ${res}`);
            stateManager.stop();
        });
    }

    _registerToCommunicationEvents() {
        algoRunnerCommunication.on('connection', () => {
            log.info('starting bootstrap state');
            stateManager.bootstrap();
            log.info('finished bootstrap state');
        });
        algoRunnerCommunication.on('disconnect', () => {
            log.warning('algorithm runner has disconnected');
            stateManager.reset();
        });

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
                log.debug(`progress: ${message.data.progress}`);
            }
        });
        algoRunnerCommunication.on(messages.incomming.error, (message) => {
            log.debug(`got error from algo. Error: ${message.error}`);
            stateManager.done(message);
        });
    }


    _registerToStateEvents() {
        stateManager.on(stateEvents.stateEntered, ({ job, state, results }) => {
            discovery.setState(Object.assign({}, {
                data: {
                    jobData: (job || {}).data,
                    state
                }
            }, results));
            switch (state) {
                case workerStates.ready:
                    jobConsumer.finishJob(results);
                    break;
                case workerStates.init:
                    algoRunnerCommunication.send({
                        command: messages.outgoing.initialize,
                        data: job
                    });
                    break;
                case workerStates.working:
                    algoRunnerCommunication.send({
                        command: messages.outgoing.start,
                        data: job
                    });
                    break;
                case workerStates.shutdown:
                    break;
                case workerStates.error:
                    break;
                case workerStates.stop:
                    this._stopTimeout = setTimeout(() => {
                        log.error('Timeout exceeded trying to stop algorithm. Exiting');
                        process.exit();
                    }, this._stopTimeoutMs);
                    algoRunnerCommunication.send({
                        command: messages.outgoing.stop,
                        data: job
                    });
                    break;
                default:
            }
        });
    }
}

module.exports = new Worker();
