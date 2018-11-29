const workerCommunication = require('./worker-communication');
const messages = require('./consts/messages');

class Algorunner {
    constructor() {
        this._url = null;
        this._algorithm = null;
    }

    async init(options) {
        await this._connectToWorker(options);
        await this._loadAlgorithm(options);
    }

    async _connectToWorker(options) {
        this._url = `${options.socket.protocol}://${options.socket.host}:${options.socket.port}`;
        this._registerToCommunicationEvents();
        await workerCommunication.init({ url: this._url, ...options });
    }

    _registerToCommunicationEvents() {
        console.debug(`connecting to ${this._url}`);
        workerCommunication.on('connection', () => {
            console.debug(`connected to ${this._url}`);
        });
        workerCommunication.on('disconnect', () => {
            console.debug(`disconnected from ${this._url}`);
        });
        workerCommunication.on(messages.incoming.initialize, this._init);
        workerCommunication.on(messages.incoming.start, this._start);
        workerCommunication.on(messages.incoming.stop, this._stop);
        workerCommunication.on(messages.incoming.exit, (data) => {
            const code = (data && data.exitCode) | 0;
            console.debug(`got exit command. Exiting with code ${code}`);
            process.exit(code);
        });
    }

    async _loadAlgorithm(options) {
        try {
            const algorithm = require(options.algorithm.codePath);
            console.debug(`algorithm code loaded from path: ${options.algorithm.codePath}`);
            this._algorithm = algorithm;
        }
        catch (e) {
            console.error(`unable to load algorithm code from path: ${options.algorithm.codePath} error: ${e}`);
            return e;
        }
    }

    async _init(options) {
        console.debug(`incoming socket event: ${options.command}`);
        await this._algorithm.init(options.data);
        workerCommunication.send({ command: messages.outgoing.initialized });
    }

    async _start(options) {
        console.debug(`incoming socket event: ${options.command}`);
        workerCommunication.send({ command: messages.outgoing.started });
        try {
            const output = await this._algorithm.start();
            workerCommunication.send({ command: messages.outgoing.done, data: output });
        }
        catch (error) {
            workerCommunication.send({
                command: messages.outgoing.error,
                error: {
                    code: 'Failed',
                    message: `Error: ${error.message || error}`,
                    details: error.stackTrace
                }
            });
        }
    }

    async _stop(data) {
        console.debug(`incoming socket event: ${data.command}`);
        if (process.env.IGNORE_STOP) {
            return;
        }
        await this._algorithm.stop();
        workerCommunication.send({ command: messages.outgoing.stopped });
    }
}

module.exports = new Algorunner();