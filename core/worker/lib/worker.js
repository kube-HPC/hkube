const stateManager = require('./states/stateManager');
const jobConsumer = require('./consumer/JobConsumer');
const algoRunnerCommunication = require('./algorunnerCommunication/workerCommunication');
const discovery = require('./states/discovery');
const Logger = require('logger.rf');
let log;
const {stateEvents} = require('../common/consts/events');
const {workerStates} = require('../common/consts/states');
const messages = require('./algorunnerCommunication/messages');

class Worker {
    constructor() {

    }

    async init(options) {
        log = Logger.GetLogFromContainer();
        this._registerToCommunicationEvents();
        this._registerToStateEvents();
    }

    _registerToCommunicationEvents() {
        algoRunnerCommunication.on('connection', () => {
            stateManager.bootstrap();
        })
        algoRunnerCommunication.on('disconnect', () => {
            log.warning('algorithm runner has disconnected');
            stateManager.reset();
        });

        algoRunnerCommunication.on(messages.incomming.initialized, (data) => {
            stateManager.start();
        });
        algoRunnerCommunication.on(messages.incomming.done, (data) => {
            stateManager.done(data);
        });
        algoRunnerCommunication.on(messages.incomming.progress, (data) => {
            console.log(`progress: ${data.progress}`)
        });
        // algoRunnerCommunication.on('message', (message) => {
        //     log.info(`got: ${JSON.stringify(message)}`)
        // })
    }


    _registerToStateEvents() {
        stateManager.on(stateEvents.stateEntered, ({job, state, results}) => {
            discovery.setState(Object.assign({}, {
                data: {
                    jobData: (job||{}).data,
                    state
                }
            }, results ? {results} : null));
            switch (state) {
                case workerStates.ready:
                    jobConsumer.finishJob({results});
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
                default:
            }
        })
    }

}

module.exports = new Worker();