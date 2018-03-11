const GroupBy = require('../helpers/group-by');
const producer = require('../producer/jobs-producer');
const consumer = require('../consumer/jobs-consumer');
const stateManager = require('../state/state-manager');
const progress = require('../progress/nodes-progress');
const NodesMap = require('../nodes/nodes-map');
const States = require('../state/States');
const Events = require('../consts/Events');
const { parser } = require('@hkube/parsers');
const Batch = require('../nodes/node-batch');
const WaitBatch = require('../nodes/node-wait-batch');
const Node = require('../nodes/node');
const log = require('@hkube/logger').GetLogFromContainer();
const components = require('../../common/consts/componentNames');
const { metricsNames } = require('../consts/metricsNames');
const { tracer, metrics, utils } = require('@hkube/metrics');

class TaskRunner {

    constructor() {
        this._job = null;
        this._jobId = null;
        this._pipeline = null;
        this._nodes = null;
        this._active = false;
        this._pipelineName = null;
    }

    init(options) {
        this._config = options;
        consumer.on(Events.JOBS.START, async (job) => {
            try {
                await this._startPipeline(job);
            }
            catch (error) {
                this._tryStopPipeline(error);
            }
        });
        stateManager.on(Events.JOBS.STOP, (data) => {
            this._tryStopPipeline(null, data.reason);
        });
        producer.on(Events.TASKS.WAITING, (taskId) => {
            this._setTaskState(taskId, { status: States.PENDING });
        });
        producer.on(Events.TASKS.STALLED, (taskId) => {
            this._setTaskState(taskId, { status: States.STALLED });
        });
        producer.on(Events.TASKS.CRASHED, (data) => {
            this._setTaskState(data.taskId, { status: States.FAILED, error: data.error });
            this._taskComplete(data.taskId);
        });
        stateManager.on(Events.TASKS.ACTIVE, (data) => {
            this._setTaskState(data.taskId, { status: States.ACTIVE });
        });
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
            buckets: utils.arithmatcSequence(30, 0, 2)
                .concat(utils.geometricSequence(10, 56, 2, 1).slice(2)).map(i => i * 1000)
        });
    }

    async _startPipeline(job) {
        if (this._active) {
            log.critical(`start pipeline while already started ${job.id}`, { component: components.TASK_RUNNER, jobId: job.id });
            return;
        }
        this._active = true;
        this._job = job;
        this._jobId = job.id;
        log.info(`pipeline started ${this._jobId}`, { component: components.TASK_RUNNER, jobId: this._jobId });

        await stateManager.watchTasks({ jobId: this._jobId });
        const watchState = await stateManager.watchJobState({ jobId: this._jobId });
        if (watchState && watchState.state === States.STOP) {
            this._tryStopPipeline(null, watchState.reason);
            return;
        }

        this._pipeline = await stateManager.getExecution({ jobId: this._jobId });

        if (!this._pipeline) {
            throw new Error(`unable to find pipeline ${this._jobId}`);
        }
        this._pipelineName = this._pipeline.name;
        this._nodes = new NodesMap(this._pipeline);
        this._nodes.on('node-ready', (node) => {
            log.debug(`new node ready to run: ${node.nodeName}`, { component: components.TASK_RUNNER });
            this._runNode(node.nodeName, node.parentOutput, node.index);
        })

        progress.calcMethod(this._nodes.calcProgress.bind(this._nodes));

        this._startMetrics();

        const state = await stateManager.getState({ jobId: this._jobId });
        if (state) {
            log.info(`starting recover process ${this._jobId}`, { component: components.TASK_RUNNER });
            stateManager.setDriverState({ jobId: this._jobId, data: States.RECOVERING });
            const tasks = this._checkRecovery(state);
            if (tasks.length > 0) {
                await this._recoverPipeline(tasks);
            }
            else {
                this._tryStopPipeline();
            }
        }
        else {
            await stateManager.setDriverState({ jobId: this._jobId, data: States.ACTIVE });
            await progress.info({ jobId: this._jobId, pipeline: this._pipelineName, status: States.ACTIVE });

            const entryNodes = this._nodes.findEntryNodes();
            if (entryNodes.length === 0) {
                throw new Error('unable to find entry nodes');
            }
            entryNodes.forEach(n => this._runNode(n));
        }
    }

    async _tryStopPipeline(error, reason) {
        try {
            this._stopPipeline(error, reason);
        }
        catch (err) {
            log.critical(`unable to stop pipeline ${err.message}`, { component: components.TASK_RUNNER, jobId: this._jobId });
            this._cleanJob(error);
        }
    }

    async _stopPipeline(err, reason) {
        if (!this._active) {
            log.critical(`stop pipeline while already stopped ${job.id}`, { component: components.TASK_RUNNER, jobId: job.id });
            return;
        }
        this._active = false;
        let status;
        let error;
        if (err) {
            error = err.message;
            status = States.FAILED;
            log.error(`pipeline ${status} ${error}`, { component: components.TASK_RUNNER, jobId: this._jobId, pipelineName: this._pipelineName });
            await progress.error({ jobId: this._jobId, pipeline: this._pipelineName, status, error });
            await stateManager.setJobResults({ jobId: this._jobId, pipeline: this._pipelineName, data: { error, status } });
        }
        else {
            if (reason) {
                status = States.STOPPED;
                log.info(`pipeline ${status} ${this._jobId}. ${reason}`, { component: components.TASK_RUNNER, jobId: this._jobId, pipelineName: this._pipelineName });
                await progress.info({ jobId: this._jobId, pipeline: this._pipelineName, status });
                await stateManager.setJobResults({ jobId: this._jobId, pipeline: this._pipelineName, data: { reason, status } });
            }
            else {
                status = States.COMPLETED;
                log.info(`pipeline ${status} ${this._jobId}`, { component: components.TASK_RUNNER, jobId: this._jobId, pipelineName: this._pipelineName });
                await progress.info({ jobId: this._jobId, pipeline: this._pipelineName, status });
                const result = this._nodes.nodesResults();
                await stateManager.setJobResults({ jobId: this._jobId, startTime: this._pipeline.startTime, pipeline: this._pipelineName, data: { result, status } });
            }
        }
        await stateManager.unWatchJobState({ jobId: this._jobId });
        await stateManager.unWatchTasks({ jobId: this._jobId });
        this._endMetrics(status);
        this._cleanJob(error);
    }

    async _recoverPipeline(tasks) {
        const groupBy = new GroupBy(tasks, 'status');
        log.info(`found ${groupBy.text()} tasks during recover`, { component: components.TASK_RUNNER, jobId: this._jobId, pipelineName: this._pipelineName });

        for (let task of tasks) {
            await progress.debug({ jobId: this._jobId, pipeline: this._pipelineName, status: States.ACTIVE });
            await stateManager.setTaskState({ jobId: this._jobId, taskId: task.taskId, data: task });
        }

        this._nodes.checkReadyNodes();

        if (this._nodes.isAllNodesCompleted()) {
            this._tryStopPipeline();
        }
    }

    _cleanJob(error) {
        this._pipeline = null;
        this._pipelineName = null;
        this._nodes = null;
        this._job.done(error);
        this._job = null;
        this._jobId = null;
    }

    _checkRecovery(state) {
        const tasksToUpdate = [];
        state.driverTasks.forEach(driverTask => {
            const jobTask = state.jobTasks.get(driverTask.taskId);
            if (!jobTask) {
                tasksToUpdate.push(driverTask);
            }
            else if (jobTask && jobTask.status !== driverTask.status) {
                driverTask.result = jobTask.result;
                driverTask.status = jobTask.status;
                driverTask.error = jobTask.error;
                tasksToUpdate.push(driverTask);
            }
            else if (driverTask.batchIndex) {
                this._nodes.addBatch(new Batch(driverTask));
            }
            else {
                this._nodes.setNode(new Node(driverTask));
            }
        })
        tasksToUpdate.forEach(task => {
            if (task.status === States.SUCCEED) {
                this._nodes.updateCompletedTask(task, false);
            }
        })
        return tasksToUpdate;
    }

    _startMetrics() {
        if (!this._jobId || !this._pipelineName) {
            return;
        }
        metrics.get(metricsNames.pipelines_net).start({
            id: this._jobId,
            labelValues: {
                pipeline_name: this._pipelineName
            }
        });
        tracer.startSpan({
            name: 'startPipeline',
            id: this._jobId,
            parent: this._job.data && this._job.data.spanId
        })
    }

    _endMetrics(status) {
        if (!this._jobId || !this._pipelineName) {
            return;
        }
        metrics.get(metricsNames.pipelines_net).end({
            id: this._jobId,
            labelValues: {
                status
            }
        });
        const topSpan = tracer.topSpan(this._jobId);
        if (topSpan) {
            topSpan.addTag({ status });
            topSpan.finish();
        }
    }

    _runNode(nodeName, parentOutput, index) {
        const node = this._nodes.getNode(nodeName);
        const options = {
            flowInput: this._pipeline.flowInput,
            nodeInput: node.input,
            parentOutput,
            index
        };
        const result = parser.parse(options);
        if (index) {
            this._runWaitAnyBatch(node, result.input, index, result.storage);
        }
        else if (result.batch) {
            this._runNodeBatch(node, result.input, result.storage);
        }
        else {
            this._runNodeSimple(node, result.input, result.storage);
        }
    }

    _runWaitAnyBatch(node, input, index, storage) {
        const waitNode = this._nodes.getWaitAny(node.nodeName, index);
        waitNode.input = input;
        waitNode.storage = storage;
        this._setTaskState(waitNode.taskId, waitNode);
        this._createJob(waitNode);
    }

    _runNodeSimple(node, input, storage) {
        this._nodes.setNode(new Node({ ...node, input, storage }));
        this._setTaskState(node.taskId, node);
        this._createJob(node);
    }

    _runNodeBatch(node, input, storage) {
        input.forEach((inp, ind) => {
            const batch = new Batch({
                nodeName: node.nodeName,
                batchIndex: (ind + 1),
                algorithmName: node.algorithmName,
                extraData: node.extraData,
                input: inp,
                storage
            });
            this._nodes.addBatch(batch);
            this._setTaskState(batch.taskId, batch);
            this._createJob(batch);
        })
    }

    _taskComplete(taskId) {
        if (!this._active) {
            return;
        }
        const task = this._nodes.getNodeByTaskID(taskId);
        if (!task) {
            return;
        }
        const error = this._checkBatchTolerance(task);
        if (error) {
            this._tryStopPipeline(error);
        }
        else if (this._nodes.isAllNodesCompleted()) {
            this._tryStopPipeline();
        }
        else {
            this._nodes.updateCompletedTask(task);
        }
    }

    _checkBatchTolerance(task) {
        let error;
        if (task.error) {
            if (task.batchIndex || task.waitIndex) {
                const batchTolerance = this._pipeline.options.batchTolerance;
                const states = this._nodes.getNodeStates(task.nodeName);
                const failed = states.filter(s => s === States.FAILED);
                const percent = failed.length / states.length * 100;

                if (percent >= batchTolerance) {
                    error = new Error(`${failed.length}/${states.length} (${percent}%) failed tasks, batch tolerance is ${batchTolerance}%, error: ${task.error}`);
                }
            }
            else {
                error = new Error(`${task.error}`);
            }
        }
        return error;
    }

    _setTaskState(taskId, options) {
        if (!this._active) {
            return;
        }
        const task = this._nodes.updateTaskState(taskId, options);
        if (options.error) {
            log.error(`task ${options.status} ${taskId}. error: ${options.error}`, { component: components.TASK_RUNNER, jobId: this._jobId, pipelineName: this._pipelineName, taskId, algorithmName: task.algorithmName });
        }
        else {
            log.debug(`task ${options.status} ${taskId}`, { component: components.TASK_RUNNER, jobId: this._jobId, pipelineName: this._pipelineName, taskId, algorithmName: task.algorithmName });
        }

        progress.debug({ jobId: this._jobId, pipeline: this._pipelineName, status: States.ACTIVE });
        stateManager.setTaskState({ jobId: this._jobId, taskId, data: task });
    }

    async _createJob(node) {
        const options = {
            type: node.algorithmName,
            data: {
                jobID: this._jobId,
                taskID: node.taskId,
                input: node.input,
                storage: node.storage,
                node: node.nodeName,
                batchIndex: node.batchIndex,
                pipelineName: this._pipelineName,
                extraData: node.extraData
            }
        }
        await producer.createJob(options);
    }
}

module.exports = new TaskRunner();
