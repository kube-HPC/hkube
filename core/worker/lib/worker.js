const stateManager = require('./states/stateManager');
const algoRunnerCommunication = require('./algorunnerCommunication/workerCommunication');
const Logger = require('logger.rf');
let log;
const { stateEvents } = require('../common/consts/events');
const { workerStates } = require('../common/consts/states');
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
        algoRunnerCommunication.on('disconnect', () => {
            log.warning('algorithm runner has disconnected');
        })

        algoRunnerCommunication.on(messages.incomming.initialized, (data) => {

        })

    }



    _registerToStateEvents() {
        stateManager.on(stateEvents.stateEntered, ({ job, state }) => {
            switch (state) {
                case workerStates.ready:
                    break;
                case workerStates.init:
                    algoRunnerCommunication.send({
                        command: messages.outgoing.initialize,
                        data: job
                    })
                    break;
                case workerStates.working:
                    algoRunnerCommunication.send({
                        command: messages.outgoing.start,
                        data: job
                    })
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