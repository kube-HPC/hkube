const EventEmitter = require('events');
const Logger = require('@hkube/logger');
const djsv = require('djsv');
const schema = require('./workerCommunicationConfigSchema').socketWorkerCommunicationSchema;
const socketio = require('socket.io');
const forward_emitter = require('forward-emitter');
const http = require('http');
let log;
class SocketWorkerCommunication extends EventEmitter {
    constructor() {
        super();
        this._options = null;
        this._socketServer = null;
        this._socket = null;

    }
    init(options) {
        log = Logger.GetLogFromContainer();
        return new Promise((resolve, reject) => {
            try {
                options = options || {};
                const validator = djsv(schema);
                const validatedOptions = validator(options);
                if (validatedOptions.valid) {
                    this._options = validatedOptions.instance;
                }
                else {
                    return reject(new Error(validatedOptions.errors[0]));
                }
                const server = this._options.httpServer||http.createServer();
                this._socketServer = socketio.listen(server, { pingTimeout: this._options.pingTimeout});
                this._socketServer.on('connection', (socket) => {
                    log.info('Connected!!!')
                    this._registerSocketMessages(socket);
                    this.emit('connection');
                })
                if (!this._options.httpServer){
                    server.listen(this._options.connection.port,()=>{
                        return resolve();
                    })
                }
            } catch (error) {
                return reject(error);
            }
        });
    }

    _registerSocketMessages(socket) {
        this._socket = socket;
        socket.on('commandMessage',(message)=>{
            this.emit('commandMessage',message);
        });
        socket.on('disconnect',()=>{
            log.info('socket disconnected');
            this._socket=null;
        })
    }
 /**
     * 
     * 
     * @param {any} message the message to send to the algoRunner.
     * @param {string} message.command the command for the runner. one of messages.outgoing
     * @param {object} message.data the data for the command
     * @memberof SocketWorkerCommunication
     */
    send(message){
        if (!this._socket){
            const error = 'trying to send without a connected socket';
            log.error(error);
            throw new Error(error)
        }
        this._socket.emit('commandMessage',message);
    }

    async sendForReply(message){
        new Promise(function(resolve, reject) {
            if (!this._socket){
                const error = 'trying to send without a connected socket';
                log.error(error);
                return reject(new Error(error))
            }
            this._socket.send(message,(err,res)=>{
                if (err){
                    log.error(err);
                    return reject(new Error(err));
                }
                resolve(res);
            });
        });
        
    }
}

module.exports = SocketWorkerCommunication;