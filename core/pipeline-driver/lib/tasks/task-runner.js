const EventEmitter = require('events');
const producer = require('../producer/jobs-producer');
const StateManager = require('../state/state-manager');
const Progress = require('../progress/nodes-progress');
const NodesMap = require('../nodes/nodes-map');
const NodeStates = require('../state/NodeStates');
const DriverStates = require('../state/DriverStates');
const Events = require('../consts/Events');
const { parser } = require('@hkube/parsers');
const Batch = require('../nodes/node-batch');
const Node = require('../nodes/node');
const log = require('@hkube/logger').GetLogFromContainer();
const component = require('../../common/consts/componentNames').TASK_RUNNER;
const { metricsNames } = require('../consts/metricsNames');
const { tracer, metrics, utils } = require('@hkube/metrics');
const graphStore = require('../datastore/graph-store');

metrics.addTimeMeasure({
    name: metricsNames.pipelines_net,
    labels: ['pipeline_name', 'status'],
    buckets: utils.arithmatcSequence(30, 0, 2)
        .concat(utils.geometricSequence(10, 56, 2, 1).slice(2)).map(i => i * 1000)
});

metrics.addGaugeMeasure({
    name: metricsNames.pipelines_progress,
    labels: ['pipeline_name', 'jobId', 'status'],
});

class TaskRunner extends EventEmitter {
    constructor(options) {
        super();
        this._job = null;
        this._jobId = null;
        this._nodes = null;
        this._active = false;
        this._stateManager = null;
        this._progress = null;
        this._driverStatus = null;
        this._jobStatus = null;
        this._error = null;
        this.pipeline = null;
        this._getDiscoveryData = this._getDiscoveryData.bind(this);
        this._init(options);
    }

    _init() {
        this._stateManager = new StateManager({ discoveryMethod: this._getDiscoveryData });
        this._stateManager.on(Events.JOBS.STOP, (data) => {
            this.stop(null, data.reason);
        });
        this._stateManager.on(Events.TASKS.ACTIVE, (task) => {
            this._handleTaskEvent(task);
        });
        this._stateManager.on(Events.TASKS.SUCCEED, (task) => {
            this._handleTaskEvent(task);
        });
        this._stateManager.on(Events.TASKS.FAILED, (task) => {
            this._handleTaskEvent(task);
        });
        this._stateManager.on(Events.TASKS.CRASHED, (task) => {
            const data = { ...task, status: NodeStates.FAILED };
            this._handleTaskEvent(data);
        });
    }

    _handleTaskEvent(task) {
        switch (task.status) {
            case NodeStates.ACTIVE:
                this._setTaskState(task.taskId, { status: NodeStates.ACTIVE });
                break;
            case NodeStates.FAILED:
            case NodeStates.SUCCEED:
                this._setTaskState(task.taskId, { status: task.status, error: task.error, result: task.result });
                this._taskComplete(task.taskId);
                break;
            default:
        }
    }

    async start(job) {
        if (this._active) {
            return;
        }
        this._active = true;
        try {
            await this._startPipeline(job);
            await graphStore.start(job.data.jobId, this._nodes);
            this.emit(DriverStates.ACTIVE, this._getDiscoveryData());
        }
        catch (error) {
            this.stop(error);
        }
    }

    async stop(error, reason) {
        if (!this._active) {
            return;
        }
        this._active = false;
        try {
            await this._stopPipeline(error, reason);
        }
        catch (err) {
            log.critical(`unable to stop pipeline ${err.message}`, { component, jobId: this._jobId });
        }
        finally {
            await this._stateManager.deleteTasks({ jobId: this._jobId });
            await graphStore.deleteGraph({ jobId: this._jobId });
            await this._cleanJob(error);
        }
    }

    async _startPipeline(job) {
        this._job = job;
        this._jobId = job.data.jobId;
        this._jobStatus = DriverStates.ACTIVE;
        log.info(`pipeline started ${this._jobId}`, { component, jobId: this._jobId });

        this.pipeline = await this._stateManager.getExecution({ jobId: this._jobId });

        if (!this.pipeline) {
            throw new Error(`unable to find pipeline for job ${this._jobId}`);
        }

        await this._stateManager.watchTasks({ jobId: this._jobId });
        const watchState = await this._stateManager.watchJobState({ jobId: this._jobId });
        if (watchState && watchState.state === DriverStates.STOP) {
            this.stop(null, watchState.reason);
            return;
        }

        this._nodes = new NodesMap(this.pipeline);
        this._nodes.on('node-ready', (node) => {
            log.debug(`new node ready to run: ${node.nodeName}`, { component });
            this._runNode(node.nodeName, node.parentOutput, node.index);
        });
        this._progress = new Progress({ calcProgress: this._nodes.calcProgress, sendProgress: this._stateManager.setJobStatus });

        this._startMetrics();

        const graph = await graphStore.getGraph({ jobId: this._jobId });
        if (graph) {
            log.info(`starting recover process ${this._jobId}`, { component });
            this._driverStatus = DriverStates.RECOVERING;
            this._recoverPipeline(graph);
            await this._progress.info({ jobId: this._jobId, pipeline: this.pipeline.name, status: DriverStates.RECOVERING });
        }
        else {
            this._driverStatus = DriverStates.ACTIVE;
            await this._progress.info({ jobId: this._jobId, pipeline: this.pipeline.name, status: DriverStates.ACTIVE });
            const entryNodes = this._nodes.findEntryNodes();

            if (entryNodes.length === 0) {
                throw new Error('unable to find entry nodes');
            }
            entryNodes.forEach(n => this._runNode(n));
        }
    }

    async _stopPipeline(err, reason) {
        let status;
        let error;
        let data;
        if (err) {
            error = err.message;
            status = DriverStates.FAILED;
            this._error = error;
            log.error(`pipeline ${status} ${error}`, { component, jobId: this._jobId, pipelineName: this.pipeline.name });
            await this._progressError({ status, error });
            if (err.batchTolerance) {
                await this._stateManager.stopJob({ jobId: this._jobId });
            }
        }
        else if (reason) {
            status = DriverStates.STOPPED;
            log.info(`pipeline ${status} ${this._jobId}. ${reason}`, { component, jobId: this._jobId, pipelineName: this.pipeline.name });
            await this._progressInfo({ status });
        }
        else {
            status = DriverStates.COMPLETED;
            log.info(`pipeline ${status} ${this._jobId}`, { component, jobId: this._jobId, pipelineName: this.pipeline.name });
            await this._progressInfo({ status });
            data = this._nodes.pipelineResults();
        }
        this._jobStatus = status;
        this.emit(status, this._getDiscoveryData());
        await this._stateManager.setJobResults({ jobId: this._jobId, startTime: this.pipeline.startTime, pipeline: this.pipeline.name, data, reason, error, status });
        await this._stateManager.unWatchJobState({ jobId: this._jobId });
        await this._stateManager.unWatchTasks({ jobId: this._jobId });
        this._endMetrics(status);
    }

    async _progressError({ status, error }) {
        if (this._progress) {
            await this._progress.error({ jobId: this._jobId, pipeline: this.pipeline.name, status, error });
        }
        else {
            await this._stateManager.setJobStatus({ jobId: this._jobId, startTime: this.pipeline.startTime, pipeline: this.pipeline.name, status, error });
        }
    }

    async _progressInfo({ status }) {
        if (this._progress) {
            await this._progress.info({ jobId: this._jobId, pipeline: this.pipeline.name, status });
        }
        else {
            await this._stateManager.setJobStatus({ jobId: this._jobId, startTime: this.pipeline.startTime, pipeline: this.pipeline.name, status });
        }
    }

    get pipeline() {
        return this._pipeline || { startTime: Date.now() };
    }

    set pipeline(pipeline) {
        this._pipeline = pipeline;
    }

    _getDiscoveryData() {
        const discoveryInfo = {
            jobID: this._jobId,
            pipelineName: this.pipeline.name,
            driverStatus: this._driverStatus,
            jobStatus: this._jobStatus,
            error: this._error
        };
        return discoveryInfo;
    }

    async _cleanJob(error) {
        await graphStore.stop();
        this.pipeline = null;
        this._nodes = null;
        this._job.done(error);
        this._job = null;
        this._jobId = null;
        this._error = null;
        this._driverStatus = null;
        this._jobStatus = null;
        this._stateManager.clean();
        this._stateManager = null;
        this._progress = null;
    }

    async _recoverPipeline(graph) {
        this._nodes.setJSONGraph(graph);
        const tasks = await this._stateManager.tasksList({ jobId: this._jobId });

        if (this._nodes.isAllNodesCompleted()) {
            this.stop();
        }
        else if (tasks.size > 0) {
            const tasksGraph = this._nodes._getNodesAsFlat();
            tasksGraph.forEach((g) => {
                const task = tasks.get(g.taskId);
                if (task && task.status !== g.status) {
                    g.result = task.result;
                    g.status = task.status;
                    g.error = task.error;
                    this._handleTaskEvent(g);
                }
            });
        }
    }

    _startMetrics() {
        if (!this._jobId || !this.pipeline.name) {
            return;
        }
        metrics.get(metricsNames.pipelines_net).start({
            id: this._jobId,
            labelValues: {
                pipeline_name: this.pipeline.name
            }
        });
        tracer.startSpan({
            name: 'startPipeline',
            id: this._jobId,
            parent: this._job.data && this._job.data.spanId
        });
    }

    _endMetrics(status) {
        if (!this._jobId || !this.pipeline.name) {
            return;
        }
        metrics.get(metricsNames.pipelines_net).end({
            id: this._jobId,
            labelValues: {
                status
            }
        });

        this._setProgressMetric(status);

        const topSpan = tracer.topSpan(this._jobId);
        if (topSpan) {
            topSpan.addTag({ status });
            topSpan.finish();
        }
    }

    _setProgressMetric(status) {
        metrics.get(metricsNames.pipelines_progress).set({
            value: this._progress.currentProgress,
            labelValues: {
                status,
                jobId: this._jobId,
                pipeline_name: this.pipeline.name
            }
        });
    }

    _runNode(nodeName, parentOutput, index) {
        const node = this._nodes.getNode(nodeName);
        const parse = {
            flowInput: this.pipeline.flowInput,
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
        else {
            this._nodes.updateCompletedTask(task);

            if (this._nodes.isAllNodesCompleted()) {
                this.stop();
            }
        }
    }

    _checkBatchTolerance(task) {
        let error;
        if (task.error) {
            if (task.batchIndex) {
                const { batchTolerance } = this.pipeline.options;
                const states = this._nodes.getNodeStates(task.nodeName);
                const failed = states.filter(s => s === NodeStates.FAILED);
                const percent = ((failed.length / states.length) * 100).toFixed(0);

                if (percent >= batchTolerance) {
                    error = new Error(`${failed.length}/${states.length} (${percent}%) failed tasks, batch tolerance is ${batchTolerance}%, error: ${task.error}`);
                    error.batchTolerance = true;
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
            log.error(`task ${options.status} ${taskId}. error: ${options.error}`, { component, jobId: this._jobId, pipelineName: this.pipeline.name, taskId, algorithmName: task.algorithmName });
        }
        else {
            log.debug(`task ${options.status} ${taskId}`, { component, jobId: this._jobId, pipelineName: this.pipeline.name, taskId, algorithmName: task.algorithmName });
        }
        this._progress.debug({ jobId: this._jobId, pipeline: this.pipeline.name, status: DriverStates.ACTIVE });
        this._setProgressMetric(NodeStates.ACTIVE);
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
                pipelineName: this.pipeline.name,
                priority: this.pipeline.priority,
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
