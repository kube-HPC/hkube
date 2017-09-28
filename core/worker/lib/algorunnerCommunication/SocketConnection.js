const EventEmitter = require('events');
const messages = require('./messages');
class SocketConnection extends EventEmitter{
    constructor(socket) {
        super();
        this._socket = socket;
        Object.keys(messages.incomming).forEach((key)=>{
            const eventName = messages.incomming[key];
            console.log(`registering to ${key}`);
            this._socket.on(eventName,(...args)=>{
                this.emit(eventName,...args);
            });
        })
        

        
    }
};

module.exports = SocketConnection;
