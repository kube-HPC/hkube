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
        this._socket = socketio(this._url);
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