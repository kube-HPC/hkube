const EventEmitter = require('events');
const log = require('logger.rf').GetLogFromContainer();
const djsv = require('djsv');
const schema = require('./workerCommunicationConfigSchema').socketWorkerCommunicationSchema;
const socketio = require('socket.io');
const forward_emitter = require('forward-emitter');

class SocketWorkerCommunication extends EventEmitter {
    constructor() {
        super();
        this._options = null;
        this._socketServer = null;
        this._socket = null;

    }
    init(options) {
        return new Promise((resolve, reject) => {
            try {
                options = options || {};
                const validator = djsv(schema);
                const validatedOptions = validator(options);
                if (validatedOptions.valid) {
                    this._options = validatedOptions.instance;
                }
                else {
                    return reject(new Error(validatedOptions.errorDescription));
                }
                this._socketServer = socketio.listen(this._options.httpServer, { pingTimeout: this._options.pingTimeout });
                this._socketServer.on('connection', (socket) => {
                    log.info('Connected!!!')
                    this._registerSocketMessages(socket);
                })
                return resolve();
            } catch (error) {
                return reject(error);
            }
        });
    }

    _registerSocketMessages(socket) {
        this._socket = socket;
        forward_emitter(socket, this);
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
        this._socket.send(message);
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