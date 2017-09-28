const SocketConnection = require('../lib/algorunnerCommunication/SocketConnection')
const messages = require('../lib/algorunnerCommunication/messages')
const expect = require('chai').expect
const EventEmitter = require('events');
describe('New connection',()=>{
    it('should create a new connection object',()=>{
        const socket = new EventEmitter();
        const connection = new SocketConnection(socket);
        expect(connection).to.not.be.a('null');
    })
    it('should pass all events in messages.js',(done)=>{
        const socket = new EventEmitter();
        const connection = new SocketConnection(socket);
        connection.on(messages.incomming.ping,()=>{
            done();
        })
        socket.emit(messages.incomming.ping);
    })
})