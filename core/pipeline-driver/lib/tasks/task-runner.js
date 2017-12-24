const uuidv4 = require('uuid/v4');
const producer = require('lib/producer/jobs-producer');
const consumer = require('lib/consumer/jobs-consumer');
const stateManager = require('lib/state/state-manager');
const progress = require('lib/progress/nodes-progress');
const NodesMap = require('lib/nodes/nodes-map');
const States = require('lib/state/States');
const Events = require('lib/consts/Events');
const inputParser = require('lib/parsers/input-parser');
const Batch = require('lib/nodes/node-batch');
const Node = require('lib/nodes/node');
const log = require('@hkube/logger').GetLogFromContainer();
const components = require('common/consts/componentNames');
const { metricsNames } = require('../consts/metricsNames');
const metrics = require('@hkube/metrics');

class TaskRunner {

    constructor() {
        this._job = null;
        this._pipeline = null;
        this._nodes = null;
    }

    init(options) {
        this._config = options;
        consumer.on(Events.JOBS.START, async (job) => {
            try {
                await this._startPipeline(job);
            }
            catch (error) {
                this._stopPipeline(error);
            }
        });
        stateManager.on(Events.JOBS.STOP, (data) => {
            this._stopPipeline(null, data.reason);
        });
        producer.on(Events.TASKS.WAITING, (taskId) => {
            this._setTaskState(taskId, { status: States.PENDING });
        })
        producer.on(Events.TASKS.ACTIVE, (taskId) => {
            this._setTaskState(taskId, { status: States.ACTIVE });
        })
        stateManager.on(Events.TASKS.SUCCEED, (data) => {
            this._setTaskState(data.taskId, { status: data.status, result: data.result });
            this._taskComplete(data.taskId);
        });
        stateManager.on(Events.TASKS.FAILED, (data) => {
            this._setTaskState(data.taskId, { status: data.status, error: data.error });
            this._taskComplete(data.taskId);
        });
        metrics.addTimeMeasure({
            name: metricsNames.pipelines_net,
            labels: ['pipeline_name', 'status'],
            buckets: [1, 2, 4, 8, 16, 32, 64, 128, 256].map(t => t * 1000)
        })
    }

    async _startPipeline(job) {
        this._job = job;
        this._jobId = job.id;
        log.info(`pipeline started ${this._jobId}`, { component: components.TASK_RUNNER });
        this._pipeline = await stateManager.getExecution({ jobId: this._jobId });
        if (!this._pipeline) {
            throw new Error(`unable to find pipeline ${this._jobId}`);
        }
        metrics.get(metricsNames.pipelines_net).start({
            id: job.id,
            labelValues: {
                pipeline_name: this._pipeline.name
            }
        });

        await stateManager.watchTasks({ jobId: this._jobId });
        const watchState = await stateManager.watchJobState({ jobId: this._jobId });
        if (watchState && watchState.obj && watchState.obj.state === States.STOP) {
            this._stopPipeline(null, watchState.obj.reason);
        }
        this._nodes = new NodesMap(this._pipeline);
        this._nodes.on('state-changed', (task) => {
            if (task.error) {
                log.error(`task ${task.status} ${task.taskId}. error: ${task.error}`, { component: components.TASK_RUNNER });
            }
            else {
                log.info(`task ${task.status} ${task.taskId}`, { component: components.TASK_RUNNER });
            }
            progress.debug({ jobId: this._jobId, pipeline: this._pipeline.name, status: States.ACTIVE });
            stateManager.setTaskState({ jobId: this._jobId, taskId: task.taskId, data: task });
        })

        progress.calcMethod(this._nodes.calc.bind(this._nodes));

        // first we will try to get the state for this job
        const state = await stateManager.getState({ jobId: this._jobId });
        if (state) {
            log.info(`starting recover process ${this._jobId}`, { component: components.TASK_RUNNER });
            stateManager.setDriverState({ jobId: this._jobId, data: States.RECOVERING });
            this._recoverPipeline(state);
        }
        else {
            stateManager.setDriverState({ jobId: this._jobId, data: States.ACTIVE });
            progress.info({ jobId: this._jobId, pipeline: this._pipeline.name, status: States.ACTIVE });

            const entryNodes = this._nodes.findEntryNodes();
            if (entryNodes.length === 0) {
                throw new Error('unable to find entry nodes');
            }
            entryNodes.forEach(n => this._runNode(n));
        }
    }

    async _stopPipeline(error, reason) {
        let status;
        if (error) {
            status = States.FAILED;
            log.error(`pipeline failed ${error.message}`, { component: components.TASK_RUNNER });
            progress.error({ jobId: this._jobId, pipeline: this._pipeline.name, status, error: error.message });
            stateManager.setJobResults({ jobId: this._jobId, pipeline: this._pipeline.name, data: { error: error.message, status } });
            this._job.done(error.message);
        }
        else {
            if (reason) {
                status = States.STOPPED;
                log.info(`pipeline stopped ${this._jobId}. ${reason}`, { component: components.TASK_RUNNER });
                progress.info({ jobId: this._jobId, pipeline: this._pipeline.name, status });
                stateManager.setJobResults({ jobId: this._jobId, pipeline: this._pipeline.name, data: { reason, status } });
            }
            else {
                status = States.COMPLETED;
                log.info(`pipeline completed ${this._jobId}`, { component: components.TASK_RUNNER });
                progress.info({ jobId: this._jobId, pipeline: this._pipeline.name, status });
                const result = this._nodes.nodesResults();
                stateManager.setJobResults({ jobId: this._jobId, pipeline: this._pipeline.name, data: { result, status } });
            }

        }
        await stateManager.unWatchJobState({ jobId: this._jobId });
        await stateManager.unWatchTasks({ jobId: this._jobId });
        const tasks = await stateManager.getDriverTasks({ jobId: this._jobId });
        if (tasks) {
            await Promise.all(tasks.map(t => producer.stopJob({ type: t.algorithmName, jobID: this._jobId })));
        }
        metrics.get(metricsNames.pipelines_net).end({
            id: this._jobId,
            labelValues: {
                status
            }
        });

        this._pipeline = null;
        this._nodes = null;
        this._job.done();
        this._job = null;
    }

    async _recoverPipeline(state) {
        const tasksToRun = [];
        state.driverTasks.forEach(driverTask => {
            const jobTask = state.jobTasks.get(driverTask.taskId);
            if (jobTask && jobTask.status !== driverTask.status) {
                driverTask.result = jobTask.result;
                driverTask.status = jobTask.status;
                driverTask.error = jobTask.error;
                this._setTaskState(driverTask.taskId, driverTask);
                log.info(`found ${driverTask.status} task ${driverTask.taskId} after recover`, { component: components.TASK_RUNNER });
                tasksToRun.push(driverTask);
            }
            if (driverTask.batchID) {
                this._nodes.addBatch(new Batch(driverTask));
            }
            else {
                this._nodes.setNode(driverTask.nodeName, new Node(driverTask));
            }
        })

        for (let task of tasksToRun) {
            this._taskComplete(task);
        }
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

    _runNodeInner(node, data) {
        if (data.batch) {
            this._runBatch(node, data.input);
        }
        else {
            const taskId = this._createTaskID(node);
            node.taskId = taskId;
            this._nodes.setNode(node.nodeName, { input: data.input });
            this._setTaskState(taskId, node);
            this._createJob(node);
        }
    }

    _runBatch(node, batchArray) {
        if (!Array.isArray(batchArray)) {
            throw new Error(`node ${node.nodeName} batch input must be an array`);
        }
        batchArray.forEach(async (inp, ind) => {
            const taskId = this._createTaskID(node);
            const batch = new Batch({
                taskId: taskId,
                nodeName: node.nodeName,
                batchID: `${node.nodeName}#${(ind + 1)}`,
                algorithmName: node.algorithmName,
                input: inp
            });
            this._nodes.addBatch(batch);
            this._setTaskState(taskId, batch);
            this._createJob(batch);
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
        this._nodes.setNode(node.nodeName, { input: input });
        this._createJob(node);
    }

    _taskComplete(taskId) {
        if (!this._nodes) {
            return;
        }
        const task = this._nodes.getNodeByTaskID(taskId);
        if (!task) {
            return;
        }
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
        if (this._nodes.isAllNodesDone()) {
            this._stopPipeline();
        }
        else {
            this._runNextNode(task.nodeName);
        }
    }

    _setTaskState(taskId, task) {
        if (!this._nodes) {
            return;
        }
        this._nodes.updateTaskState(taskId, task);
    }

    async _createJob(node) {
        const options = {
            type: node.algorithmName,
            data: {
                input: node.input,
                node: node.batchID || node.nodeName,
                jobID: this._jobId,
                taskID: node.taskId
            }
        }
        await producer.createJob(options);
    }

    _createTaskID(node) {
        return [node.nodeName, node.algorithmName, uuidv4()].join(':');
    }
}

module.exports = new TaskRunner();
