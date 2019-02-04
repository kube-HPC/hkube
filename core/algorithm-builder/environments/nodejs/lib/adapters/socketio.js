const EventEmitter = require('events');
const socketio = require('socket.io-client');
const messages = require('../consts/messages');

class AlgorithmSocket extends EventEmitter {
    constructor(options) {
        super();
        this._socket = null;
        this._url = options.url;
        this._connect();
    }

    _connect() {
        const socketOptions = {
            transports: ['websocket'],
            rejectUnauthorized: false
        };
        const url = new URL(this._url);
        socketOptions.path = url.pathname;
        this._socket = socketio(url.origin, socketOptions.path === '/' ? null : socketOptions);
        this._registerSocketMessages(this._socket);
    }

    _registerSocketMessages(socket) {
        Object.values(messages.incoming).forEach((topic) => {
            socket.on(topic, (message) => {
                this.emit(topic, message);
            });
        });
        socket.on('connect', () => {
            this.emit('connection');
        });
        socket.on('disconnect', () => {
            this.emit('disconnect');
        });
    }

    send(message) {
        this._socket.emit(message.command, message);
    }
}

module.exports = AlgorithmSocket;