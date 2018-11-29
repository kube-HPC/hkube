const EventEmitter = require('events');
const socketio = require('socket.io-client');
const messages = require('../consts/messages');

class AlgorithmSocket extends EventEmitter {
    constructor() {
        super();
        this._socket = null;
        this._url = null;
    }

    async init(url) {
        this._url = url;
        this._socket = socketio(url);
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