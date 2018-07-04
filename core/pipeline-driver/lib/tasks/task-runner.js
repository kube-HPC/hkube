const GroupBy = require('../helpers/group-by');
const producer = require('../producer/jobs-producer');
const StateManager = require('../state/state-manager');
const Progress = require('../progress/nodes-progress');
const NodesMap = require('../nodes/nodes-map');
const States = require('../state/States');
const Events = require('../consts/Events');
const { parser } = require('@hkube/parsers');
const Batch = require('../nodes/node-batch');
const Node = require('../nodes/node');
const log = require('@hkube/logger').GetLogFromContainer();
const component = require('../../common/consts/componentNames').TASK_RUNNER;
const { metricsNames } = require('../consts/metricsNames');
const { tracer, metrics, utils } = require('@hkube/metrics');

metrics.addTimeMeasure({
    name: metricsNames.pipelines_net,
    labels: ['pipeline_name', 'status'],
    buckets: utils.arithmatcSequence(30, 0, 2)
        .concat(utils.geometricSequence(10, 56, 2, 1).slice(2)).map(i => i * 1000)
});

class TaskRunner {
    constructor(options) {
        this._job = null;
        this._jobId = null;
        this._pipeline = null;
        this._nodes = null;
        this._active = false;
        this._pipelineName = null;
        this._pipelinePriority = null;
        this._stateManager = null;
        this._progress = null;
        this._init(options);
    }

    _init() {
        this._stateManager = new StateManager();
        this._stateManager.on(Events.JOBS.STOP, (data) => {
            this.stop(null, data.reason);
        });
        this._stateManager.on(Events.TASKS.ACTIVE, (data) => {
            this._setTaskState(data.taskId, { status: States.ACTIVE });
        });
        this._stateManager.on(Events.TASKS.SUCCEED, (data) => {
            this._setTaskState(data.taskId, { status: data.status, result: data.result });
            this._taskComplete(data.taskId);
        });
        this._stateManager.on(Events.TASKS.FAILED, (data) => {
            this._setTaskState(data.taskId, { status: data.status, error: data.error });
            this._taskComplete(data.taskId);
        });
    }

    async start(job) {
        try {
            await this._startPipeline(job);
        }
        catch (error) {
            this.stop(error);
            throw error;
        }
    }

    async stop(error, reason) {
        try {
            await this._stopPipeline(error, reason);
        }
        catch (err) {
            log.critical(`unable to stop pipeline ${err.message}`, { component, jobId: this._jobId });
        }
        finally {
            await this._stateManager.deleteDriverState({ jobId: this._jobId });
            await this._stateManager.deleteWorkersState({ jobId: this._jobId });
            this._cleanJob(error);
        }
    }

    async _startPipeline(job) {
        if (this._active) {
            return;
        }
        this._active = true;
        this._job = job;
        this._jobId = job.data.jobId;
        log.info(`pipeline started ${this._jobId}`, { component, jobId: this._jobId });

        this._pipeline = await this._stateManager.getExecution({ jobId: this._jobId });

        if (!this._pipeline) {
            this._active = false;
            throw new Error(`unable to find pipeline ${this._jobId}`);
        }

        this._pipelineName = this._pipeline.name;
        this._pipelinePriority = this._pipeline.priority;
        this._nodes = new NodesMap(this._pipeline);
        this._nodes.on('node-ready', (node) => {
            log.debug(`new node ready to run: ${node.nodeName}`, { component });
            this._runNode(node.nodeName, node.parentOutput, node.index);
        });
        this._progress = new Progress({ calcProgress: this._nodes.calcProgress, sendProgress: this._stateManager.setJobStatus });

        await this._stateManager.watchTasks({ jobId: this._jobId });
        const watchState = await this._stateManager.watchJobState({ jobId: this._jobId });
        if (watchState && watchState.state === States.STOP) {
            this.stop(null, watchState.reason);
            return;
        }

        this._startMetrics();

        const state = await this._stateManager.getState({ jobId: this._jobId });
        if (state) {
            log.info(`starting recover process ${this._jobId}`, { component });
            this._stateManager.setDriverState({ jobId: this._jobId, data: States.RECOVERING });
            const tasks = this._checkRecovery(state);
            if (tasks.length > 0) {
                await this._recoverPipeline(tasks);
            }
            else {
                this.stop();
            }
        }
        else {
            await this._stateManager.setDriverState({ jobId: this._jobId, data: States.ACTIVE });
            await this._progress.info({ jobId: this._jobId, pipeline: this._pipelineName, status: States.ACTIVE });

            const entryNodes = this._nodes.findEntryNodes();
            if (entryNodes.length === 0) {
                throw new Error('unable to find entry nodes');
            }
            entryNodes.forEach(n => this._runNode(n));
        }
    }

    async _stopPipeline(err, reason) {
        if (!this._active) {
            return;
        }
        this._active = false;
        let status;
        let error;
        let data;
        if (err) {
            error = err.message;
            status = States.FAILED;
            log.error(`pipeline ${status} ${error}`, { component, jobId: this._jobId, pipelineName: this._pipelineName });
            await this._progress.error({ jobId: this._jobId, pipeline: this._pipelineName, status, error });
        }
        else if (reason) {
            status = States.STOPPED;
            log.info(`pipeline ${status} ${this._jobId}. ${reason}`, { component, jobId: this._jobId, pipelineName: this._pipelineName });
            await this._progress.info({ jobId: this._jobId, pipeline: this._pipelineName, status });
        }
        else {
            status = States.COMPLETED;
            log.info(`pipeline ${status} ${this._jobId}`, { component, jobId: this._jobId, pipelineName: this._pipelineName });
            await this._progress.info({ jobId: this._jobId, pipeline: this._pipelineName, status });
            data = this._nodes.pipelineResults();
        }
        await this._stateManager.setJobResults({ jobId: this._jobId, startTime: this._pipeline.startTime, pipeline: this._pipelineName, data, reason, error, status });
        await this._stateManager.unWatchJobState({ jobId: this._jobId });
        await this._stateManager.unWatchTasks({ jobId: this._jobId });
        this._endMetrics(status);
    }

    async _recoverPipeline(tasks) {
        const groupBy = new GroupBy(tasks, 'status');
        log.info(`found ${groupBy.text()} tasks during recover`, { component, jobId: this._jobId, pipelineName: this._pipelineName });

        for (let task of tasks) { // eslint-disable-line
            await this._progress.debug({ jobId: this._jobId, pipeline: this._pipelineName, status: States.ACTIVE }); // eslint-disable-line
            await this._stateManager.setTaskState({ jobId: this._jobId, taskId: task.taskId, data: task }); // eslint-disable-line
        }

        if (this._nodes.isAllNodesCompleted()) {
            this.stop();
        }
    }

    _cleanJob(error) {
        this._pipeline = null;
        this._pipelineName = null;
        this._nodes = null;
        this._job.done(error);
        this._job = null;
        this._jobId = null;
        this._stateManager.clean();
        this._stateManager = null;
        this._progress = null;
    }

    _checkRecovery(state) {
        const tasksToUpdate = [];
        state.driverTasks.forEach((driverTask) => {
            const jobTask = state.jobTasks.get(driverTask.taskId);
            if (jobTask && jobTask.status !== driverTask.status) {
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
        });
        tasksToUpdate.forEach((task) => {
            if (task.status === States.SUCCEED) {
                this._nodes.updateCompletedTask(task, false);
            }
        });
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
        });
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
        const parse = {
            flowInput: this._pipeline.flowInput,
            nodeInput: node.input,
            parentOutput,
            index
        };
        const result = parser.parse(parse);
        const paths = this._nodes.extractPaths(nodeName);

        const options = {
            node,
            index,
            paths,
            input: result.input,
            storage: result.storage
        };
        if (index && result.batch) {
            this._runWaitAnyBatch(options);
        }
        else if (index) {
            this._runWaitAny(options);
        }
        else if (result.batch) {
            this._runNodeBatch(options);
        }
        else {
            this._runNodeSimple(options);
        }
    }

    _runWaitAny(options) {
        const waitAny = new Batch({
            ...options.node,
            batchIndex: options.index,
            input: options.input,
            storage: options.storage
        });
        const batch = [waitAny];
        this._nodes.addBatch(waitAny);
        this._setTaskState(waitAny.taskId, waitAny);
        this._createJob(options, batch);
    }

    // TODO: CHECK THIS
    _runWaitAnyBatch(options) {
        const waitNode = this._nodes.getWaitAny(options.node.nodeName, options.index);
        options.input.forEach((inp, ind) => {
            const batch = new Batch({
                nodeName: waitNode.nodeName,
                batchIndex: (ind + 1),
                algorithmName: waitNode.algorithmName,
                extraData: waitNode.extraData,
                input: inp
            });
            this._nodes.addBatch(batch);
            this._setTaskState(batch.taskId, batch);
            this._createJob(batch, options.storage);
        });
    }

    _runNodeSimple(options) {
        const node = new Node({
            ...options.node,
            input: options.input
        });
        this._nodes.setNode(node);
        this._setTaskState(node.taskId, node);
        this._createJob(options);
    }

    _runNodeBatch(options) {
        options.input.forEach((inp, ind) => {
            const batch = new Batch({
                ...options.node,
                batchIndex: (ind + 1),
                input: inp.input,
                storage: inp.storage
            });
            this._nodes.addBatch(batch);
            this._setTaskState(batch.taskId, batch);
        });
        this._createJob(options, options.node.batch);
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
            this.stop(error);
        }
        else if (this._nodes.isAllNodesCompleted()) {
            this.stop();
        }
        else {
            this._nodes.updateCompletedTask(task);
        }
    }

    _checkBatchTolerance(task) {
        let error;
        if (task.error) {
            if (task.batchIndex || task.waitIndex) {
                const { batchTolerance } = this._pipeline.options;
                const states = this._nodes.getNodeStates(task.nodeName);
                const failed = states.filter(s => s === States.FAILED);
                const percent = (failed.length / states.length) * 100;

                if (percent >= batchTolerance) {
                    error = new Error(`${failed.length}/${states.length} (${percent}%) failed tasks, batch tolerance is ${batchTolerance}%, error: ${task.error}`);
                }
            }
            else {
                error = new Error(task.error);
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
            log.error(`task ${options.status} ${taskId}. error: ${options.error}`, { component, jobId: this._jobId, pipelineName: this._pipelineName, taskId, algorithmName: task.algorithmName });
        }
        else {
            log.debug(`task ${options.status} ${taskId}`, { component, jobId: this._jobId, pipelineName: this._pipelineName, taskId, algorithmName: task.algorithmName });
        }
        this._progress.debug({ jobId: this._jobId, pipeline: this._pipelineName, status: States.ACTIVE });
        this._stateManager.setTaskState({ jobId: this._jobId, taskId, data: task });
    }

    _createJob(options, batch) {
        let tasks = [];
        if (batch) {
            tasks = batch.map(b => ({ taskID: b.taskId, input: b.input, batchIndex: b.batchIndex, storage: b.storage }));
        }
        else {
            tasks.push({ taskID: options.node.taskId, input: options.node.input, storage: options.storage });
        }
        const jobOptions = {
            type: options.node.algorithmName,
            data: {
                tasks,
                jobID: this._jobId,
                nodeName: options.node.nodeName,
                pipelineName: this._pipelineName,
                priority: this._pipelinePriority,
                algorithmName: options.node.algorithmName,
                info: {
                    extraData: options.node.extraData,
                    savePaths: options.paths
                }
            }
        };
        return producer.createJob(jobOptions);
    }
}

module.exports = TaskRunner;
