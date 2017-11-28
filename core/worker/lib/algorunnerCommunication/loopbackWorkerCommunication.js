const EventEmitter = require('events');
const log = require('@hkube/logger').GetLogFromContainer();
const djsv = require('djsv');
const schema = require('./workerCommunicationConfigSchema').socketWorkerCommunicationSchema;
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
    start() {
        this.emit('connection')

    }
    send(message) {
        switch (message.command) {
            case messages.outgoing.initialize:
                this._simulateSend({ command: messages.incomming.initialized, data: message.data });
                break;
            case messages.outgoing.start:
                this._simulateSend({ command: messages.incomming.started, data: message.data });
                break;
            case messages.outgoing.cleanup:
                this._simulateSend({ command: messages.incomming.done, data: message.data });
                break;
            case messages.outgoing.stop:
                this._simulateSend({ command: messages.incomming.stopped, data: message.data });
                break;
            case messages.outgoing.ping:
                this._simulateSend({ command: messages.incomming.pong, data: message.data });
                break;
            default:

        }
    }

    _simulateSend(message) {
        this.emit(message.command, message.data)
        // return new Promise((resolve, reject)=> {
        //     this.emit('message', message);
        //     resolve();
        // });
    }

}

module.exports = LoopbackWorkerCommunication;