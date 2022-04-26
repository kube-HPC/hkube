const EventEmitter = require('events');
const http = require('http');
const WebSocket = require('ws');
const url = require('url');
const Logger = require('@hkube/logger');
const { Encoding } = require('@hkube/encoding');
const Validator = require('ajv');
const { socketWorkerCommunicationSchema: schema } = require('./schema');
const { Components, debugMessages } = require('../consts');
const component = Components.COMMUNICATIONS;
const validator = new Validator({ useDefaults: true, coerceTypes: true });
let log;
let connectedPromise;
let resolveConnected;
class WsWorkerCommunication extends EventEmitter {
    constructor() {
        super();
        this._socketServer = null;
        this._socket = null;
        this._queryData = null;
        connectedPromise = new Promise((res) => {
            resolveConnected = res;
        });
    }

    async init(option) {
        log = Logger.GetLogFromContainer();
        return new Promise((resolve, reject) => { // eslint-disable-line consistent-return
            try {
                const options = option || {};
                const valid = validator.validate(schema, options);
                if (!valid) {
                    return reject(new Error(validator.errorsText(validator.errors)));
                }
                const server = http.createServer();
                this._socketServer = new WebSocket.Server({ server, maxPayload: options.maxPayload });

                this._socketServer.on('connection', (socket, opt) => {
                    if (this._socketServer.clients.size > 1) {
                        log.info(`Debugger already connected from ${this._queryData?.hostname}`);
                        socket.send(this._encoding.encode({ command: debugMessages.outgoing.alreadyConnectedError, data: { hostname: this._queryData?.hostname } }));
                        socket.close(debugMessages.codes.close);
                    }
                    else {
                        const data = url.parse(opt.url, true).query;
                        log.info(`Debugger connected from ${data.hostname || 'unknown'}`, { component });
                        this._registerSocketMessages(socket, data);
                        this.setEncodingType(data.encoding);
                        this.emit('connection', data);
                    }
                });
                this._socketServer.on('error', (error) => {
                    log.error(`error ${error}`, { component });
                });
                this._socketServer.on('listening', () => {
                    log.info('listening', { component });
                });

                server.listen(options.port, () => {
                    return resolve();
                });
            }
            catch (error) {
                return reject(error);
            }
        });
    }

    setEncodingType(type) {
        this._encoding = new Encoding({ type });
    }

    _registerSocketMessages(socket, queryData) {
        this._socket = socket;
        this._queryData = queryData;
        resolveConnected();
        socket.on('message', (data) => {
            const payload = this._encoding.decode(data);
            log.info(`got message ${payload.command}`, { component });
            this.emit(payload.command, payload.data || payload);
        });
        socket.on('close', (code) => {
            log.info('Debug connection closed');
            const reason = code === 1006 ? 'CLOSE_ABNORMAL' : `${code}`;
            this._socket = null;
            this._queryData = null;
            connectedPromise = new Promise((res) => {
                resolveConnected = res;
            });
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
    async send(message) {
        await connectedPromise;
        this._socket.send(this._encoding.encode(message));
    }
}

module.exports = new WsWorkerCommunication();
