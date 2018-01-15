const EventEmitter = require('events');
const Logger = require('@hkube/logger');
const djsv = require('djsv');
const schema = require('./workerCommunicationConfigSchema').socketWorkerCommunicationSchema;
const socketio = require('socket.io');
const messages = require('./messages');
const http = require('http');
const components = require('../../common/consts/componentNames');
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
        return new Promise((resolve, reject) => { // eslint-disable-line consistent-return
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
                const server = this._options.httpServer || http.createServer();
                this._socketServer = socketio.listen(server, { pingTimeout: this._options.pingTimeout });
                this._socketServer.on('connection', (socket) => {
                    log.info('Connected!!!', { component: components.COMMUNICATIONS });
                    this._registerSocketMessages(socket);
                    this.emit('connection');
                });
                if (!this._options.httpServer) {
                    server.listen(this._options.connection.port, () => {
                        return resolve();
                    });
                }
            }
            catch (error) {
                return reject(error);
            }
        });
    }

    _registerSocketMessages(socket) {
        this._socket = socket;
        Object.values(messages.incomming).forEach((topic) => {
            log.debug(`registering for topic ${topic}`, { component: components.COMMUNICATIONS });

            socket.on(topic, (message) => {
                log.debug(`got message on topic ${topic}, data: ${JSON.stringify(message)}`, { component: components.COMMUNICATIONS });
                this.emit(topic, message);
            });
        });
        // socket.on('commandMessage',(message)=>{
        //     this.emit('commandMessage',message);
        // });
        socket.on('disconnect', () => {
            log.debug('socket disconnected', { component: components.COMMUNICATIONS });
            this._socket = null;
        });
        log.debug('finish _registerSocketMessages', { component: components.COMMUNICATIONS });
    }
    /**
     * 
     * 
     * @param {any} message the message to send to the algoRunner.
     * @param {string} message.command the command for the runner. one of messages.outgoing
     * @param {object} message.data the data for the command
     * @memberof SocketWorkerCommunication
     */
    send(message) {
        if (!this._socket) {
            const error = new Error('trying to send without a connected socket');
            log.error(`Error sending message to algorithm. error: ${error.message}`, { component: components.COMMUNICATIONS }, error);
            throw error;
        }
        this._socket.emit(message.command, message);
    }
}

module.exports = SocketWorkerCommunication;
