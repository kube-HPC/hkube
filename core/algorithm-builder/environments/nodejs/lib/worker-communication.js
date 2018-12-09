const EventEmitter = require('events');
const AlgorithmSocket = require('./adapters/socketio');
const AlgorithmWS = require('./adapters/ws');
const adapters = require('./consts/adapters');
const messages = require('./consts/messages');

class WorkerCommunication extends EventEmitter {
    constructor() {
        super();
        this._options = null;
        this._adapters = {};
        this._adapters[adapters.socket] = AlgorithmSocket;
        this._adapters[adapters.ws] = AlgorithmWS;
        this.adapter = null;
        this.connected = false;
    }

    async init(options) {
        const adapterClass = this._adapters[options.adapter];
        if (!adapterClass) {
            throw new Error(`Invalid worker communication adapter ${options.adapter}`);
        }
        console.info(`Creating communication object of type: ${options.adapter}`);
        this.adapter = new adapterClass({ url: options.url });
        console.debug(`connecting to ${options.url}`);
        Object.values(messages.incoming).forEach((topic) => {
            console.debug(`registering for topic ${topic}`);
            this.adapter.on(topic, (message) => {
                console.debug(`got message on topic ${topic}`);
                this.emit(topic, message);
            });
        });
        this.adapter.on('connection', (message) => {
            this.connected = true;
            this.emit('connection', message);
        });
        this.adapter.on('disconnect', (message) => {
            this.connected = false;
            this.emit('disconnect', message);
        });
    }

    send(message) {
        if (!this.connected) {
            throw new Error('trying to send without a connected socket')
        }
        console.debug(`sending ${message.command}`);
        return this.adapter.send(message);
    }
}

module.exports = new WorkerCommunication();