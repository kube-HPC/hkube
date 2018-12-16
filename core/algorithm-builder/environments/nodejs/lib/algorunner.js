const workerCommunication = require('./worker-communication');
const messages = require('./consts/messages');
const methods = require('./consts/methods');

class Algorunner {
    constructor() {
        this._url = null;
        this._algorithm = {};
    }

    async init(options) {
        await this._loadAlgorithm(options);
        await this._connectToWorker(options);
    }

    async _connectToWorker(options) {
        this._url = `${options.socket.protocol}://${options.socket.host}:${options.socket.port}`;
        this._registerToCommunicationEvents();
        await workerCommunication.init({ url: this._url, ...options });
    }

    _registerToCommunicationEvents() {
        workerCommunication.on('connection', () => {
            console.debug(`connected to ${this._url}`);
        });
        workerCommunication.on('disconnect', () => {
            console.debug(`disconnected from ${this._url}`);
        });
        workerCommunication.on(messages.incoming.initialize, (options) => this._init(options));
        workerCommunication.on(messages.incoming.start, (options) => this._start(options));
        workerCommunication.on(messages.incoming.stop, (options) => this._stop(options));
        workerCommunication.on(messages.incoming.exit, (options) => {
            const code = (options && options.exitCode) | 0;
            console.debug(`got exit command. Exiting with code ${code}`);
            process.exit(code);
        });
    }

    async _loadAlgorithm(options) {
        try {
            const entryPoint = options.algorithmData.entryPoint || '';
            const algorithm = require(`${options.algorithmPath}/${entryPoint}`);
            console.debug(`algorithm code loaded`);

            Object.keys(methods).forEach((m) => {
                const method = algorithm[m];
                if (method && typeof method === 'function') {
                    this._algorithm[m] = method;
                }
                else {
                    throw new Error(`unable to find method ${m}`);
                }
            });
        }
        catch (e) {
            const error = `unable to load algorithm code, error: ${e.message}`;
            this._sendError(error);
        }
    }

    async _init(options) {
        try {
            await this._algorithm.init(options.data);
            workerCommunication.send({ command: messages.outgoing.initialized });
        }
        catch (error) {
            this._sendError(error);
        }
    }

    async _start(options) {
        try {
            workerCommunication.send({ command: messages.outgoing.started });
            const output = await this._algorithm.start();
            workerCommunication.send({ command: messages.outgoing.done, data: output });
        }
        catch (error) {
            this._sendError(error);
        }
    }

    async _stop(options) {
        try {
            await this._algorithm.stop();
            workerCommunication.send({ command: messages.outgoing.stopped });
        }
        catch (error) {
            this._sendError(error);
        }
    }

    _sendError(error) {
        const message = `Error: ${error.message || error}`;
        console.error(message);
        workerCommunication.send({
            command: messages.outgoing.error,
            error: {
                code: 'Failed',
                message,
                details: error.stackTrace
            }
        });
    }
}

module.exports = new Algorunner();