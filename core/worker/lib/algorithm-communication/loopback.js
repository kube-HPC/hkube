const EventEmitter = require('events');
const Validator = require('ajv');
const schema = require('./schema').socketWorkerCommunicationSchema;
const messages = require('./messages');
const validator = new Validator({ useDefaults: true, coerceTypes: true });

class Loopback extends EventEmitter {
    constructor() {
        super();
        this._options = null;
        this.LastInput = null;
    }

    async init(option) {
        const options = option || {};
        const valid = validator.validate(schema, options);

        if (!valid) {
            throw new Error(validator.errorsText(validator.errors));
        }
    }

    start() {
        this.emit('connection');
    }

    send(message) {
        switch (message.command) {
            case messages.outgoing.initialize:
                this._lastInput = message.data;
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

    getLastInput() {
        return this._lastInput;
    }

    sendCommandWithDelay(message) {
        setTimeout(() => {
            this._simulateSend({ command: message.command, data: this._lastInput });
        }, 500);
    }

    _simulateSend(message) {
        this.emit(message.command, message.data);
    }
}

module.exports = Loopback;
