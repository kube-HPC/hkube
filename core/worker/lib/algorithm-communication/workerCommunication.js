const EventEmitter = require('events');
const Logger = require('@hkube/logger');
const djsv = require('djsv');
const schema = require('./schema').workerCommunicationSchema;
const wsAdapter = require('./ws');
const socketAdapter = require('./socket-io');
const loopbackAdapter = require('./loopback');
const { adapters } = require('./consts');
const messages = require('./messages');
const component = require('../../lib/consts').Components.COMMUNICATIONS;

let log;

class WorkerCommunication extends EventEmitter {
    constructor() {
        super();
        this._options = null;
        this._adapters = {};
        this._adapters[adapters.ws] = wsAdapter;
        this._adapters[adapters.socket] = socketAdapter;
        this._adapters[adapters.loopback] = loopbackAdapter;
        this.adapter = null;
    }

    async init(option) {
        if (this.adapter) {
            this.adapter.removeAllListeners();
            this.adapter = null;
            this.removeAllListeners();
        }
        log = Logger.GetLogFromContainer();
        const options = option || {};
        const validator = djsv(schema);
        const validatedOptions = validator(options.workerCommunication);
        if (validatedOptions.valid) {
            this._options = validatedOptions.instance;
        }
        else {
            throw new Error(validatedOptions.errorDescription);
        }
        const AdapterClass = this._adapters[this._options.adapterName];
        if (!AdapterClass) {
            throw new Error(`Invalid worker communication adapter ${this._options.adapterName}`);
        }
        log.info(`Creating communication object of type: ${this._options.adapterName}`, { component });
        this.adapter = new AdapterClass();
        Object.entries({ ...messages.incomming, connection: 'connection', disconnect: 'disconnect' }).forEach(([, topic]) => {
            log.debug(`registering for topic ${topic}`, { component });
            this.adapter.on(topic, (message) => {
                log.info(`got message on topic ${topic}, command: ${message && message.command}`, { component });
                this.emit(topic, message);
            });
        });
        await this.adapter.init(this._options.config);
    }

    /**
     *
     * @param {any} message the message to send to the algoRunner.
     * @param {string} message.command the command for the runner. one of messages.outgoing
     * @param {object} message.data the data for the command
     * @memberof WorkerCommunication
     */
    send(message) {
        if (!this.adapter._socket) {
            log.error(`Error sending message to algorithm command ${message.command}. error: socket disconnected`, { component });
            return;
        }
        this.adapter.send(message);
    }
}

module.exports = new WorkerCommunication();
