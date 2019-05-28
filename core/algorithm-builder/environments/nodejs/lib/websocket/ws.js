const EventEmitter = require('events');
const WebSocket = require('ws');

class AlgorithmWS extends EventEmitter {
    constructor(options) {
        super();
        this._socket = null;
        this._url = options.url;
        this._reconnectInterval = 5000;
        this._connect();
    }

    _connect() {
        this._socket = new WebSocket(this._url);
        this._socket.on('open', () => {
            this.emit('connection');
        });
        this._handleConnectEvents();
        this._handleMessages();
    }

    _handleConnectEvents() {
        this._socket.on('close', (code, reason) => {
            switch (code) {
                case 1000:
                    this.emit('disconnect');
                    break;
                default:
                    this._reconnect();
                    break;
            }
        });
        this._socket.on('error', (e) => {
            switch (e.code) {
                case 'ECONNREFUSED':
                    this._reconnect();
                    break;
                default:
                    this.emit('disconnect');
                    break;
            }
        });
    }

    _handleMessages() {
        this._socket.on('message', (message) => {
            const payload = JSON.parse(message);
            console.log(`got message from worker: ${payload.command}`);
            this.emit(payload.command, payload.data);
        });
    }

    _reconnect() {
        this._socket.removeAllListeners();
        setTimeout(() => {
            this._connect();
        }, this._reconnectInterval);
    }

    send(message) {
        console.log(`sending message to worker: ${message.command}`);
        this._socket.send(JSON.stringify(message));
    }
}

module.exports = AlgorithmWS;