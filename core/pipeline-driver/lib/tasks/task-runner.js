const uuidv4 = require('uuid/v4');
const producer = require('lib/producer/jobs-producer');
const consumer = require('lib/consumer/jobs-consumer');
const stateManager = require('lib/state/state-manager');
const progress = require('lib/progress/nodes-progress');
const NodesMap = require('lib/nodes/nodes-map');
const States = require('lib/state/States');
const Events = require('lib/consts/Events');
const Task = require('lib/tasks/Task');
const inputParser = require('lib/parsers/input-parser');
const Batch = require('lib/nodes/batch');
const Node = require('lib/nodes/node');
const Logger = require('@hkube/logger');
const log = Logger.GetLogFromContainer();
const components = require('common/consts/componentNames');

class TaskRunner {

    constructor() {
        this._job = null;
        this._pipeline = null;
        this._nodes = null;
    }

    init(options) {
        this._config = options;
        producer.on(Events.TASKS.WAITING, (taskId) => {
            this._updateState(taskId, { status: States.PENDING });
        })
        producer.on(Events.TASKS.ACTIVE, (taskId) => {
            this._updateState(taskId, { status: States.ACTIVE });
        })
        consumer.on(Events.JOBS.START, async (job) => {
            try {
                await this._startPipeline(job);
            }
            catch (error) {
                this._stopPipeline(error);
            }
        });
        stateManager.on(Events.JOB_STOP, (data) => {
            this._stopPipeline(null, data.reason);
        });
        stateManager.on(Events.TASKS.COMPLETED, async (data) => {
            const task = await this._updateState(data.taskId, { status: States.SUCCEED, result: data.result });
            this._taskComplete(task);
        });
        stateManager.on(Events.TASKS.FAILED, async (data) => {
            const task = await this._updateState(data.taskId, { status: States.FAILED, error: data.error });
            this._taskComplete(task);
        });
    }

    async _startPipeline(job) {
        this._isRunning = true;
        log.info(`pipeline started ${job.id}`, { component: components.TASK_RUNNER });
        stateManager.setCurrentJobID(job.id);
        this._job = job;

        await stateManager.watchTasks();
        const watchState = await stateManager.watchJobState();
        if (watchState && watchState.obj && watchState.obj.state === States.STOP) {
            this._stopPipeline(null, watchState.obj.reason);
        }
        this._pipeline = await stateManager.getExecution({ jobId: job.id });
        this._nodes = new NodesMap(this._pipeline);

        progress.calcMethod(this._nodes.calc.bind(this._nodes));

        // first we will try to get the state for this job
        const state = await stateManager.getState();
        if (state) {
            log.info(`starting recover process ${job.id}`, { component: components.TASK_RUNNER });
            stateManager.setState({ data: States.RECOVERING });
            this._recover(state);
        }
        else {
            stateManager.setState({ data: States.ACTIVE });
            progress.info({ status: States.ACTIVE });

            const entryNodes = this._nodes.findEntryNodes();
            if (entryNodes.length === 0) {
                throw new Error('unable to find entry nodes');
            }
            entryNodes.forEach(n => this._runNode(n));
        }
    }

    async _stopPipeline(error, reason) {
        this._isRunning = false;
        await stateManager.unWatchJobState();
        await stateManager.unWatchTasks();
        const tasks = await stateManager.getDriverTasks();
        if (tasks) {
            await Promise.all(tasks.map(t => producer.stopJob({ type: t.algorithm, jobID: this._job.id })));
        }
        if (error) {
            log.error(`pipeline failed ${error.message}`, { component: components.TASK_RUNNER });
            progress.error({ status: States.FAILED, error: error.message });
            stateManager.setJobResults({ error: error.message });
            this._job.done(error.message);
        }
        else {
            if (reason) {
                log.info(`pipeline stopped ${this._job.id}. ${reason}`, { component: components.TASK_RUNNER });
                progress.info({ status: States.STOPPED });
            }
            else {
                log.info(`pipeline completed ${this._job.id}`, { component: components.TASK_RUNNER });
                progress.info({ status: States.COMPLETED });
            }
            const result = this._nodes.allNodesResults();
            stateManager.setJobResults(result);
            this._job.done();
        }
        this._job = null;
        this._pipeline = null;
        this._nodes = null;
    }

    async _updateState(taskId, options) {
        if (!this._isRunning) {
            return;
        }
        if (options.error) {
            log.error(`task ${options.status} ${taskId}. error: ${options.error}`, { component: components.TASK_RUNNER });
        }
        else {
            log.info(`task ${options.status} ${taskId}`, { component: components.TASK_RUNNER });
        }
        const task = await stateManager.getTaskState({ taskId: taskId });
        task.status = options.status;
        task.result = options.result;
        task.error = options.error;
        await this._setTaskState(task);
        return task;
    }

    _runNextNode(nodeName) {
        const childs = this._nodes.childs(nodeName);
        childs.forEach(child => {
            const node = this._nodes.getNode(child);
            const waitAnyIndex = inputParser.waitAnyInputIndex(node.input);
            if (waitAnyIndex > -1) {
                this._runWaitAny(child, data.result);
            }
            else {
                const allFinished = this._nodes.isAllParentsFinished(child);
                if (allFinished) {
                    const results = this._nodes.parentsResults(child);
                    this._runNode(child, results);
                }
            }
        });
    }

    _runNode(nodeName, nodesInput) {
        const node = this._nodes.getNode(nodeName);
        const options = Object.assign({}, { flowInput: this._pipeline.flowInput }, { input: node.input });
        const result = inputParser.parse(options, node.input, nodesInput);
        this._runNodeInner(node, result);
    }

    async _runNodeInner(node, data) {
        if (data.batch) {
            this._runBatch(node, data.input);
        }
        else {
            this._nodes.setNode(node.name, { input: data.input });
            const taskId = this._createTaskID(node.algorithm);
            const task = new Task({
                taskId: taskId,
                nodeName: node.name,
                algorithm: node.algorithm,
                batchID: node.batchID,
                input: node.input
            })
            await this._setTaskState(task);
            this._createJob(node, taskId);
        }
    }

    _runBatch(node, batchArray) {
        if (!Array.isArray(batchArray)) {
            throw new Error(`node ${node.name} batch input must be an array`);
        }
        batchArray.forEach(async (inp, ind) => {
            const batch = new Batch({
                name: node.name,
                batchID: `${node.name}#${(ind + 1)}`,
                algorithm: node.algorithm,
                input: inp
            });
            const taskId = this._createTaskID(node.algorithm);
            const task = new Task({
                taskId: taskId,
                nodeName: batch.name,
                algorithm: batch.algorithm,
                batchID: batch.batchID,
                input: batch.input
            })
            this._nodes.addBatch(batch);
            await this._setTaskState(task);
            this._createJob(batch, taskId);
        })
    }

    _runWaitAny(nodeName, nodeInput) {
        const node = this._nodes.getNode(nodeName);
        const waitAnyIndex = inputParser.waitAnyInputIndex(node.input);
        const input = node.input.slice();
        input.forEach((inp, ind) => {
            if (inputParser.isWaitAnyBatch(inp)) {
                const nodeInput = node.input[waitAnyIndex].substr(2);
                this._runBatch(nodeName, nodeInput, waitAnyIndex);
            }
            else if (inputParser.isWaitAnyNode(inp)) {
                const ndName = node.input[waitAnyIndex].substr(2);
                const result = inputParser.extractObject(ndName);
                input[waitAnyIndex] = inputParser.parseValue(nodeInput, result.path);
            }
            else if (inputParser.isNode(inp)) {
                const ndName = node.input[ind].substr(1);
                const result = inputParser.extractObject(ndName);
                input[ind] = inputParser.parseValue(nodeInput, result.path);
            }
        });
        this._nodes.setNode(node.name, { input: input });
        this._createJob(node);
    }

    _taskComplete(task) {
        if (task.error) {
            if (task.batchID) {
                const batchTolerance = this._pipeline.options.batchTolerance;
                const states = this._nodes.getNodeStates(task.nodeName);
                const failed = states.filter(s => s === States.FAILED);
                const percent = failed.length / states.length * 100;

                if (percent >= batchTolerance) {
                    const error = new Error(`${failed.length}/${states.length} (${percent}%) failed tasks, batch tolerance is ${batchTolerance}%, error: ${task.error}`);
                    this._stopPipeline(error);
                    return;
                }
            }
            else {
                const error = new Error(`${task.error}`);
                this._stopPipeline(error);
                return;
            }
        }
        if (task.batchID) {
            progress.debug({ status: States.ACTIVE });
        }
        else {
            progress.info({ status: States.ACTIVE });
        }
        if (this._nodes.isAllNodesDone()) {
            this._stopPipeline();
        }
        else {
            this._runNextNode(task.nodeName);
        }
    }

    async _recover(state) {
        const tasksToRun = [];
        state.driverTasks.forEach(driverTask => {
            const jobTask = state.jobTasks.get(driverTask.taskId);
            if (jobTask && jobTask.status !== driverTask.status) {
                driverTask.result = jobTask.result;
                driverTask.status = jobTask.status;
                driverTask.error = jobTask.error;
                log.info(`found ${driverTask.status} task ${driverTask.taskId} after recover`, { component: components.TASK_RUNNER });
                tasksToRun.push(driverTask);
            }
            if (driverTask.batchID) {
                this._nodes.addBatch(new Batch({
                    name: driverTask.nodeName,
                    batchID: driverTask.batchID,
                    algorithm: driverTask.algorithm,
                    input: driverTask.input,
                    state: driverTask.status,
                    result: driverTask.result,
                    error: driverTask.error
                }));
            }
            else {
                this._nodes.setNode(driverTask.nodeName, new Node({
                    name: driverTask.nodeName,
                    algorithm: driverTask.algorithmName,
                    input: driverTask.input,
                    state: driverTask.status,
                    result: driverTask.result,
                    error: driverTask.error
                }));
            }
        })

        for (let task of tasksToRun) {
            await this._setTaskState(task);
            this._taskComplete(task);
        }
    }

    async _setTaskState(task) {
        this._nodes.updateNodeState(task.nodeName, task.batchID, { state: task.status, error: task.error, result: task.result });
        await stateManager.setTaskState({ taskId: task.taskId, data: task });
        progress.debug({ status: States.ACTIVE });
    }

    async _createJob(node, taskId) {
        const options = {
            taskId: taskId,
            type: node.algorithm,
            data: {
                input: node.input,
                node: node.batchID || node.name,
                jobID: this._job.id
            }
        }
        await producer.createJob(options);
    }

    _createTaskID(type) {
        return [type, uuidv4()].join(':');
    }
}

module.exports = new TaskRunner();
