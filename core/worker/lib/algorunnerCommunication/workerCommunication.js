const EventEmitter = require('events');
const Logger = require('@hkube/logger');
let log;
const djsv = require('djsv');
const schema = require('./workerCommunicationConfigSchema').workerCommunicationSchema;
const wsAdapter = require('./wsWorkerCommunication');
const socketAdapter = require('./socketWorkerCommunication');
const loopbackAdapter = require('./loopbackWorkerCommunication');
const { adapters } = require('./consts');
const messages = require('./messages');
const components = require('../../common/consts/componentNames');


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
    async init(options) {
        if (this.adapter) {
            this.adapter.removeAllListeners();
            this.adapter = null;
            this.removeAllListeners();
        }
        log = Logger.GetLogFromContainer();
        options = options || {};
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
        log.info(`Creating communication object of type: ${this._options.adapterName}`, { component: components.COMMUNICATIONS });
        this.adapter = new AdapterClass();
        // forwardEmitter(this.adapter, this);
        Object.entries({ ...messages.incomming, connection: 'connection', disconnect: 'disconnect' }).forEach(([name, topic]) => {
            log.debug(`workerCommunication registering for topic (${name})=>${topic}`, { component: components.COMMUNICATIONS });
            this.adapter.on(topic, (message) => {
                log.debug(`workerCommunication got message on topic (${name})=>${topic}, data: ${JSON.stringify(message)}`, { component: components.COMMUNICATIONS });
                this.emit(topic, message);
            });
        });
        await this.adapter.init(this._options.config);
    }

    /**
     * 
     * 
     * @param {any} message the message to send to the algoRunner.
     * @param {string} message.command the command for the runner. one of messages.outgoing
     * @param {object} message.data the data for the command
     * @memberof WorkerCommunication
     */
    async send(message) {
        return this.adapter.send(message);
    }
}

module.exports = new WorkerCommunication();
