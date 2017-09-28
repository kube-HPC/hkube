const EventEmitter = require('events');
const log = require('logger.rf').GetLogFromContainer();
const djsv = require('djsv');
const schema = require('./workerCommunicatioConfigSchema').socketWorkerCommunicationSchema;
const messages = require('./messages');

class LoopbackWorkerCommunication extends EventEmitter {
    constructor() {
        super();
        this._options = null;
        this._loopback=new EventEmitter();
    }
    async init(options) {
        options = options || {};
        const validator = djsv(schema);
        const validatedOptions = validator(options);
        if (validatedOptions.valid) {
            this._options = validatedOptions.instance;
        }
        else {
            throw new Error(validatedOptions.errorDescription);
        }
        Object.keys(messages.incomming).forEach((key)=>{
            const eventName = messages.incomming[key];
            this._loopback.on(eventName,(...args)=>{
                this.emit(eventName,...args);
            });
        })
    }
}

module.exports = LoopbackWorkerCommunication;