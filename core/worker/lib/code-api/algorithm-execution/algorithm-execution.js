const uuidv4 = require('uuid/v4');
const Validator = require('ajv');
const { consts } = require('@hkube/parsers');
const Logger = require('@hkube/logger');
const storageManager = require('@hkube/storage-manager');
const { Producer } = require('@hkube/producer-consumer');
const algoRunnerCommunication = require('../../algorithm-communication/workerCommunication');
const discovery = require('../../states/discovery');
const messages = require('../../algorithm-communication/messages');
const { Components, taskEvents } = require('../../consts');
const jobConsumer = require('../../consumer/JobConsumer');
const { producerSchema, startAlgorithmSchema, stopAlgorithmSchema } = require('./schema');
const validator = new Validator({ useDefaults: true, coerceTypes: false });
const component = Components.ALGORITHM_EXECUTION;
let log;

class AlgorithmExecution {
    init(options) {
        log = Logger.GetLogFromContainer();
        this._watching = false;
        this._executions = new Map();
        this._producerSchema = validator.compile(producerSchema);
        this._startAlgorithmSchema = validator.compile(startAlgorithmSchema);
        this._stopAlgorithmSchema = validator.compile(stopAlgorithmSchema);
        this._initProducer(options);
        this._registerToEtcdEvents();
        this._registerToAlgorithmEvents();
    }

    _initProducer(options) {
        const setting = Object.assign({}, { redis: options.redis });
        const valid = this._producerSchema(setting);
        if (!valid) {
            throw new Error(validator.errorsText(this._producerSchema.errors));
        }
        this._producer = new Producer({ setting });
    }

    _registerToEtcdEvents() {
        discovery.on(taskEvents.SUCCEED, (task) => {
            this._sendDoneToAlgorithm(task);
            this._deleteExecution(task.execId);
        });
        discovery.on(taskEvents.FAILED, (task) => {
            this._sendErrorToAlgorithm(task);
            this._deleteExecution(task.execId);
        });
        discovery.on(taskEvents.STALLED, (task) => {
            this._sendErrorToAlgorithm(task);
            this._deleteExecution(task.execId);
        });
        discovery.on(taskEvents.CRASHED, (task) => {
            this._sendErrorToAlgorithm(task);
            this._deleteExecution(task.execId);
        });
    }

    _registerToAlgorithmEvents() {
        algoRunnerCommunication.on(messages.incomming.startAlgorithmExecution, (message) => {
            this._startAlgorithmExecution(message);
        });
        algoRunnerCommunication.on(messages.incomming.stopAlgorithmExecution, (message) => {
            this._stopAlgorithmExecution(message);
        });
    }

    _deleteExecution(execId) {
        this._executions.delete(execId);
    }

    async _sendDoneToAlgorithm(task) {
        const execution = this._executions.get(task.execId);
        if (!execution) {
            return;
        }
        let { result } = task;
        if (execution.resultAsRaw && task.result && task.result.storageInfo) {
            result = await storageManager.get(task.result.storageInfo);
        }
        log.debug('sending done to algorithm', { component });
        this._sendCompleteToAlgorithm({ ...task, response: result, command: messages.outgoing.execAlgorithmDone });
    }

    _sendErrorToAlgorithm(task) {
        log.info(`sending error to algorithm, error: ${task.error}`, { component });
        this._sendCompleteToAlgorithm({ ...task, command: messages.outgoing.execAlgorithmError });
    }

    _sendCompleteToAlgorithm({ command, execId, error, response }) {
        algoRunnerCommunication.send({
            command,
            data: {
                execId,
                response,
                error
            }
        });
    }

    async _unWatchTasks({ jobId }) {
        if (this._watching) {
            this._watching = false;
            await discovery.unWatchTasks({ jobId });
        }
    }

    async _watchTasks({ jobId }) {
        if (!this._watching) {
            this._watching = true;
            await discovery.watchTasks({ jobId });
        }
    }

    async stopAllExecutions({ jobId }) {
        let response = null;
        if (this._stopping) {
            return response;
        }
        try {
            this._stopping = true;
            if (!jobId) {
                throw new Error('jobId was not supplied');
            }
            await this._unWatchTasks({ jobId });

            if (this._executions.size === 0) {
                log.info('no registered executions to stop', { component });
                return response;
            }
            log.info(`stopping ${this._executions.size} executions`, { component });
            response = await Promise.all([...this._executions.values()].map(e => discovery.stopAlgorithmExecution({ jobId, taskId: e.taskId })));
        }
        catch (e) {
            log.warning(`failed to stop executions: ${e.message}`, { component });
        }
        finally {
            this._executions.clear();
            this._stopping = false;
        }
        return response;
    }

    async _stopAlgorithmExecution(message) {
        let execId;
        try {
            const data = (message && message.data) || {};
            const valid = this._stopAlgorithmSchema(data);
            if (!valid) {
                throw new Error(validator.errorsText(this._stopAlgorithmSchema.errors));
            }
            execId = data.execId; // eslint-disable-line
            if (!this._executions.has(execId)) {
                throw new Error(`unable to find execId ${execId}`);
            }
            const { jobId } = jobConsumer.jobData;
            const execution = this._executions.get(execId);
            await discovery.stopAlgorithmExecution({ jobId, taskId: execution.taskId, reason: data.reason });
        }
        catch (e) {
            this._sendErrorToAlgorithm({ execId, error: e.message });
        }
    }

    async _startAlgorithmExecution(message) {
        let execId;
        try {
            const data = (message && message.data) || {};
            const valid = this._startAlgorithmSchema(data);
            if (!valid) {
                throw new Error(validator.errorsText(this._startAlgorithmSchema.errors));
            }
            execId = data.execId; // eslint-disable-line
            if (this._executions.has(execId)) {
                throw new Error('execution already running');
            }
            const { jobData } = jobConsumer;
            if (!jobData) {
                throw new Error('execution cannot start in this state');
            }

            const storage = {};
            const { jobId, nodeName } = jobData;
            const { algorithmName, input, resultAsRaw } = data;
            const algos = await discovery.getExistingAlgorithms();
            if (!algos.find(algo => algo.name === algorithmName)) {
                throw new Error(`Algorithm named '${algorithmName}' does not exist`);
            }
            const taskId = this._createTaskID({ nodeName, algorithmName });
            this._executions.set(execId, { taskId, resultAsRaw });
            const storageInput = await Promise.all(input.map(i => this._mapInputToStorage(i, storage, jobId)));
            const task = { execId, taskId, input: storageInput, storage };
            const job = this._createJobData({ algorithmName, task, jobData });

            await this._watchTasks({ jobId });
            await this._createJob(job);
        }
        catch (e) {
            this._sendErrorToAlgorithm({ execId, error: e.message });
        }
    }

    _createJob(job) {
        return this._producer.createJob({ job });
    }

    _createJobData({ algorithmName, task, jobData }) {
        const jobOptions = {
            type: algorithmName,
            data: {
                tasks: [task],
                jobId: jobData.jobId,
                nodeName: jobData.nodeName,
                pipelineName: jobData.pipelineName,
                priority: jobData.priority,
                algorithmName,
                info: jobData.info
            }
        };
        return jobOptions;
    }

    async _mapInputToStorage(data, storage, jobId) {
        if (!this._isPrimitive(data)) {
            const uuid = uuidv4();
            const storageInfo = await storageManager.hkube.put({ jobId, taskId: uuid, data });
            storage[uuid] = { storageInfo }; // eslint-disable-line
            return `${consts.inputs.STORAGE}${uuid}`;
        }
        return data;
    }

    _createTaskID({ nodeName, algorithmName }) {
        return [nodeName, algorithmName, uuidv4()].join(':');
    }

    _isPrimitive(val) {
        return typeof val === 'boolean' || typeof val === 'number';
    }
}

module.exports = new AlgorithmExecution();
