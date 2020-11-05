const EventEmitter = require('events');
const Logger = require('@hkube/logger');
const Validator = require('ajv');
const schema = require('./schema').workerCommunicationSchema;
const wsAdapter = require('./ws');
const socketAdapter = require('./socket-io');
const loopbackAdapter = require('./loopback');
const { adapters } = require('./consts');
const messages = require('./messages');
const component = require('../consts').Components.COMMUNICATIONS;
const validator = new Validator({ useDefaults: true, coerceTypes: true });
let log;

class WorkerCommunication extends EventEmitter {
    constructor() {
        super();
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
        const options = option.workerCommunication;
        const valid = validator.validate(schema, options);
        if (!valid) {
            throw new Error(validator.errorsText(validator.errors));
        }
        const AdapterClass = this._adapters[options.adapterName];
        if (!AdapterClass) {
            throw new Error(`Invalid worker communication adapter ${options.adapterName}`);
        }
        log.info(`Creating communication object of type: ${options.adapterName}`, { component });
        this.adapter = new AdapterClass();
        this._printThrottleMessages = {
            [messages.incomming.streamingStatistics]: { delay: 30000, lastPrint: null }
        };
        Object.entries({ ...messages.incomming, connection: 'connection', disconnect: 'disconnect' }).forEach(([, topic]) => {
            log.debug(`registering for topic ${topic}`, { component });
            this.adapter.on(topic, (message) => {
                this._printThrottle(topic, message);
                this.emit(topic, message);
            });
        });
        await this.adapter.init(options);
    }

    _printThrottle(topic, message) {
        const setting = this._printThrottleMessages[topic];
        let shouldPrint = true;
        if (setting) {
            const { delay, lastPrint } = setting;
            if (lastPrint === null || Date.now() - lastPrint > delay) {
                shouldPrint = true;
                setting.lastPrint = Date.now();
            }
            else {
                shouldPrint = false;
            }
        }
        if (shouldPrint) {
            log.info(`got message on topic ${topic}, command: ${message && message.command}`, { component });
        }
    }

    setEncodingType(type) {
        this.adapter.setEncodingType && this.adapter.setEncodingType(type);
    }

    /**
     *
     * @param {any} message the message to send to the algoRunner.
     * @param {string} message.command the command for the runner. one of messages.outgoing
     * @param {object} message.data the data for the command
     * @memberof WorkerCommunication
     */
    send(message) {
        this.adapter.send(message);
    }
}

module.exports = new WorkerCommunication();
