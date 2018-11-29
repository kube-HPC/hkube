const EventEmitter = require('events');
const AlgorithmSocket = require('./adapters/algorithm-socketio');
const AlgorithmWS = require('./adapters/algorithm-ws');
const adapters = require('./consts/consts').adapters;
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
        if (this.adapter) {
            this.adapter.removeAllListeners();
            this.adapter = null;
            this.removeAllListeners();

        }
        options = options || {};
        const adapterClass = this._adapters[options.adapter];
        if (!adapterClass) {
            throw new Error(`Invalid worker communication adapter ${options.adapter}`);
        }
        console.info(`Creating communication object of type: ${options.adapter}`);
        this.adapter = new adapterClass();
        await this.adapter.init(options.url);
        Object.values(messages.incoming).forEach((topic) => {
            console.debug(`registering for topic ${topic}`);
            this.adapter.on(topic, (message) => {
                console.debug(`got message on topic ${topic}`);
                this.emit(topic, message);
            });
        });

        this.adapter.on('connection', (message) => {
            this.connected = true;
            console.debug(`got message on topic connection`);
            this.emit('connection', message);
        });
        this.adapter.on('disconnect', (message) => {
            this.connected = false;
            console.debug(`got message on topic disconnect`);
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