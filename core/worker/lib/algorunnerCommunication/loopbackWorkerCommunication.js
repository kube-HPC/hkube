const EventEmitter = require('events');
const log = require('logger.rf').GetLogFromContainer();
const djsv = require('djsv');
const schema = require('./workerCommunicatioConfigSchema').socketWorkerCommunicationSchema;
const messages = require('./messages');

class LoopbackWorkerCommunication extends EventEmitter {
    constructor() {
        super();
        this._options = null;
    }
    async init(options) {
        options = options || {};
        const validator = djsv(schema);
        const validatadOptions = validator(options);
        if (validatadOptions.valid) {
            this._options = validatadOptions.instance;
        }
        else {
            throw new Error(validatadOptions.errorDescription);
        }


    }

    send(message) {
        switch (message.command) {
            case messages.outgoing.initialize:
                this.emit('message', { command: messages.incomming.initialized, data: message.data })
                break;
            case messages.outgoing.start:
                this.emit('message', { command: messages.incomming.started, data: message.data })
                break;
            case messages.outgoing.cleanup:
                this.emit('message', { command: messages.incomming.done, data: message.data })
                break;
            case messages.outgoing.stop:
                this.emit('message', { command: messages.incomming.stopped, data: message.data })
                break;
            case messages.outgoing.ping:
                this.emit('message', { command: messages.incomming.pong, data: message.data })
                break;
            default:

        }
    }
}

module.exports = LoopbackWorkerCommunication;