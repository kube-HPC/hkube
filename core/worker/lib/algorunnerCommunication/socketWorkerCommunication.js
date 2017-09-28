const EventEmitter = require('events');
const log = require('logger.rf').GetLogFromContainer();
const djsv = require('djsv');
const schema = require('./workerCommunicatioConfigSchema').socketWorkerCommunicationSchema;
const socketio = require('socket.io');
class SocketWorkerCommunication extends EventEmitter {
    constructor() {
        super();
        this._options = null;
        this._socketServer = null;
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
                this._socketServer = socketio.listen(this._options.httpServer,{pingTimeout: this._options.pingTimeout});
                const path=this._options.connection.path;
                const ns = path.substring(path.lastIndexOf('/'));
                this._sockerServerNamespace=this._socketServer.of(ns);
                this._sockerServerNamespace.on('connection',(socket)=>{
                    log.info('Connected!!!')    
                })
                return resolve();
            } catch (error) {
                return reject(error);
            }
        });
    }
}

module.exports = SocketWorkerCommunication;