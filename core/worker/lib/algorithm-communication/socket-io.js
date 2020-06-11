const EventEmitter = require('events');
const http = require('http');
const socketio = require('socket.io');
const Logger = require('@hkube/logger');
const Validator = require('ajv');
const schema = require('./schema').socketWorkerCommunicationSchema;
const messages = require('./messages');
const component = require('../consts').Components.COMMUNICATIONS;
const validator = new Validator({ useDefaults: true, coerceTypes: true });
let log;

class SocketWorkerCommunication extends EventEmitter {
    constructor() {
        super();
        this._socketServer = null;
        this._socket = null;
    }

    init(option) {
        log = Logger.GetLogFromContainer();
        return new Promise((resolve, reject) => { // eslint-disable-line consistent-return
            try {
                const options = option || {};
                const valid = validator.validate(schema, options);
                if (!valid) {
                    return reject(new Error(validator.errorsText(validator.errors)));
                }
                const server = options.httpServer || http.createServer();
                this._socketServer = socketio.listen(server, {
                    pingTimeout: options.pingTimeout,
                    pingInterval: options.pingTimeout * 2,
                    maxHttpBufferSize: options.maxPayload
                });
                this._socketServer.on('connection', (socket) => {
                    log.info('Connected!!!', { component });
                    this._registerSocketMessages(socket);
                    this.emit('connection');
                });
                if (!options.httpServer) {
                    log.info(`socket-io adapter is listening on port ${options.port}`, { component });
                    server.listen(options.port, () => {
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
            log.debug(`registering for topic ${topic}`, { component });

            socket.on(topic, (message) => {
                log.debug(`got message on topic ${topic}, command: ${message && message.command}`, { component });
                this.emit(topic, message);
            });
        });
        socket.on('disconnect', (reason) => {
            log.debug('socket disconnected', { component });
            this._socket = null;
            this.emit('disconnect', reason);
        });
        log.debug('finish _registerSocketMessages', { component });
    }

    /**
     *
     * @param {any} message the message to send to the algoRunner.
     * @param {string} message.command the command for the runner. one of messages.outgoing
     * @param {object} message.data the data for the command
     * @memberof SocketWorkerCommunication
     */
    send(message) {
        if (!this._socket) {
            const error = new Error('trying to send without a connected socket');
            log.warning(`Error sending message to algorithm command ${message.command}. error: ${error.message}`, { component }, error);
            throw error;
        }
        this._socket.emit(message.command, message);
    }
}

module.exports = SocketWorkerCommunication;
