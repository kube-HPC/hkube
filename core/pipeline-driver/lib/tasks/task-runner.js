const EventEmitter = require('events');
const { parser } = require('@hkube/parsers');
const logger = require('@hkube/logger');
const pipelineMetrics = require('../metrics/pipeline-metrics');
const producer = require('../producer/jobs-producer');
const StateManager = require('../state/state-manager');
const Progress = require('../progress/nodes-progress');
const NodesMap = require('../nodes/nodes-map');
const NodeStates = require('../state/NodeStates');
const DriverStates = require('../state/DriverStates');
const Events = require('../consts/Events');
const { Node, Batch } = require('../nodes');
const component = require('../consts/componentNames').TASK_RUNNER;
const graphStore = require('../datastore/graph-store');
const { PipelineReprocess, PipelineNotFound } = require('../errors');

let log;

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
        this._paused = false;
        this._init(options);
    }

    _init(options) {
        if (!log) {
            log = logger.GetLogFromContainer();
        }
        this._stateManager = new StateManager({
            etcd: options.etcd,
            serviceName: options.serviceName,
            podName: options.kubernetes.podName,
            discoveryMethod: this._getDiscoveryData.bind(this)
        });
        this._stateManager.on(Events.COMMANDS.stopProcessing, (data) => {
            this.emit(Events.COMMANDS.stopProcessing, data);
        });
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
        this._stateManager.on(Events.TASKS.STALLED, (task) => {
            this._handleTaskEvent(task);
        });
        this._stateManager.on(Events.TASKS.CRASHED, (task) => {
            const data = { ...task, status: NodeStates.FAILED };
            this._handleTaskEvent(data);
        });
    }

    _handleTaskEvent(task) {
        switch (task.status) {
            case NodeStates.STALLED:
                this._setTaskState(task);
                break;
            case NodeStates.ACTIVE:
                this._setTaskState(task);
                break;
            case NodeStates.FAILED:
            case NodeStates.SUCCEED:
                this._setTaskState(task);
                this._taskComplete(task.taskId);
                break;
            default:
                log.error(`invalid task status ${task.status}`, { component, jobId: this._jobId });
                break;
        }
    }

    async start(job) {
        let result = null;
        if (this._active) {
            return result;
        }
        this._active = true;
        try {
            this._cleanState();
            result = await this._startPipeline(job);
        }
        catch (e) {
            log.error(e.message, { component, jobId: this._jobId }, e);
            await this.stop(e);
        }
        return result;
    }

    async stop(error, reason) {
        if (!this._active) {
            return;
        }
        this._active = false;
        try {
            await this._stopPipeline(error, reason);
        }
        catch (e) {
            log.error(`unable to stop pipeline, ${e.message}`, { component, jobId: this._jobId }, e);
        }
        finally {
            await this._deletePipeline();
            await this._unWatchJob();
            await this._cleanJob(error);
        }
    }

    async _startPipeline(job) {
        this._job = job;
        this._jobId = job.data.jobId;
        this._jobStatus = DriverStates.ACTIVE;
        log.info(`pipeline started ${this._jobId}`, { component, jobId: this._jobId });

        const jobStatus = await this._stateManager.getJobStatus({ jobId: this._jobId });
        if (this._stateManager.isCompletedState(jobStatus)) {
            throw new PipelineReprocess(jobStatus.status);
        }

        const pipeline = await this._stateManager.getExecution({ jobId: this._jobId });
        if (!pipeline) {
            throw new PipelineNotFound(this._jobId);
        }

        await this._watchJobState();

        this.pipeline = pipeline;
        this._nodes = new NodesMap(this.pipeline);
        this._nodes.on('node-ready', (node) => {
            this._runNode(node.nodeName, node.parentOutput, node.index);
        });
        this._progress = new Progress({
            calcProgress: this._nodes.calcProgress,
            sendProgress: this._stateManager.setJobStatus
        });

        pipelineMetrics.startMetrics({ jobId: this._jobId, pipeline: this.pipeline.name, spanId: this._job.data && this._job.data.spanId });

        const graph = await graphStore.getGraph({ jobId: this._jobId });
        if (graph) {
            log.info(`starting recover process ${this._jobId}`, { component });
            this._driverStatus = DriverStates.RECOVERING;
            this._nodes.setJSONGraph(graph);
            await this._watchTasks();
            await this._recoverPipeline();
            await this._progress.info({ jobId: this._jobId, pipeline: this.pipeline.name, status: DriverStates.RECOVERING });
        }
        else {
            this._driverStatus = DriverStates.ACTIVE;
            await this._progress.info({ jobId: this._jobId, pipeline: this.pipeline.name, status: DriverStates.ACTIVE });
            await this._watchTasks();
            this._runEntryNodes();
        }
        await graphStore.start(job.data.jobId, this._nodes);
        return this.pipeline;
    }

    async _stopPipeline(err, reason) {
        let status;
        let errorMsg;
        let data;
        if (err) {
            if (err.status) {
                return;
            }
            errorMsg = err.message;
            status = DriverStates.FAILED;
            this._error = errorMsg;
            log.error(`pipeline ${status}. ${errorMsg}`, { component, jobId: this._jobId, pipelineName: this.pipeline.name });
        }
        else if (reason) {
            status = DriverStates.STOPPED;
            log.info(`pipeline ${status} ${this._jobId}. ${reason}`, { component, jobId: this._jobId, pipelineName: this.pipeline.name });
        }
        else {
            status = DriverStates.COMPLETED;
            log.info(`pipeline ${status} ${this._jobId}`, { component, jobId: this._jobId, pipelineName: this.pipeline.name });
            data = this._nodes.pipelineResults();
        }
        this._jobStatus = status;
        this._driverStatus = DriverStates.READY;
        const resultError = await this._stateManager.setJobResults({ jobId: this._jobId, startTime: this.pipeline.startTime, pipeline: this.pipeline.name, data, reason, error: errorMsg, status });

        if (errorMsg || resultError) {
            const error = resultError || errorMsg;
            await this._progressError({ status, error });
            if (err.batchTolerance) {
                await this._stateManager.stopJob({ jobId: this._jobId });
            }
        }
        else {
            await this._progressInfo({ status });
        }

        pipelineMetrics.endMetrics({ jobId: this._jobId, pipeline: this.pipeline.name, progress: this._currentProgress, status });
    }

    _runEntryNodes() {
        const entryNodes = this._nodes.findEntryNodes();
        if (entryNodes.length === 0) {
            throw new Error('unable to find entry nodes');
        }
        entryNodes.forEach(n => this._runNode(n));
    }

    get _currentProgress() {
        return (this._progress && this._progress.currentProgress) || 0;
    }

    async _watchJobState() {
        const watchState = await this._stateManager.watchJobState({ jobId: this._jobId });
        if (watchState && watchState.state === DriverStates.STOP) {
            await this.stop(null, watchState.reason);
        }
    }

    async _watchTasks() {
        await this._stateManager.watchTasks({ jobId: this._jobId });
    }

    async _unWatchJob() {
        try {
            await Promise.all([
                this._stateManager.unWatchJobState({ jobId: this._jobId }),
                this._stateManager.unWatchTasks({ jobId: this._jobId })
            ]);
        }
        catch (e) {
            log.error(e.message, { component, jobId: this._jobId }, e);
        }
    }

    async _deletePipeline() {
        try {
            await Promise.all([
                this._stateManager.deleteTasksList({ jobId: this._jobId }),
                graphStore.deleteGraph({ jobId: this._jobId })
            ]);
        }
        catch (e) {
            log.error(e.message, { component, jobId: this._jobId }, e);
        }
    }

    async _progressError({ status, error }) {
        if (this._progress) {
            await this._progress.error({ jobId: this._jobId, pipeline: this.pipeline.name, status, error });
        }
        else {
            await this._stateManager.setJobStatus({ jobId: this._jobId, pipeline: this.pipeline.name, status, error });
        }
    }

    async _progressInfo({ status }) {
        if (this._progress) {
            await this._progress.info({ jobId: this._jobId, pipeline: this.pipeline.name, status });
        }
        else {
            await this._stateManager.setJobStatus({ jobId: this._jobId, pipeline: this.pipeline.name, status });
        }
    }

    get pipeline() {
        return this._pipeline || { startTime: Date.now() };
    }

    set pipeline(pipeline) {
        this._pipeline = pipeline;
    }

    async setPaused() {
        this._paused = true;
        this._jobStatus = DriverStates.PAUSED;
        await this._stateManager.updateDiscovery();
    }

    _getDiscoveryData() {
        const discoveryInfo = {
            jobId: this._jobId,
            pipelineName: this.pipeline.name,
            driverStatus: this._driverStatus,
            jobStatus: this._jobStatus,
            error: this._error,
            paused: this._paused
        };
        return discoveryInfo;
    }

    async _cleanJob(error) {
        await graphStore.stop();
        this._nodes = null;
        this._job && this._job.done(error);
        this._job = null;
        this._progress = null;
    }

    async _cleanState() {
        this.pipeline = null;
        this._paused = false;
        this._jobId = null;
        this._error = null;
        this._driverStatus = null;
        this._jobStatus = null;
    }

    async _recoverPipeline() {
        if (this._nodes.isAllNodesCompleted()) {
            this.stop();
        }
        else {
            const tasks = await this._stateManager.tasksList({ jobId: this._jobId });
            if (tasks.size > 0) {
                const tasksGraph = this._nodes._getNodesAsFlat();
                tasksGraph.forEach((g) => {
                    const task = tasks.get(g.taskId);
                    if (task && task.status !== g.status) {
                        const t = {
                            ...g,
                            result: task.result,
                            status: task.status,
                            error: task.error
                        };
                        this._handleTaskEvent(t);
                    }
                });
            }
            else {
                this._runEntryNodes();
            }
        }
    }

    async _runNode(nodeName, parentOutput, index) {
        try {
            log.info(`node ${nodeName} is ready to run`, { component });
            const node = this._nodes.getNode(nodeName);
            const parse = {
                flowInput: this.pipeline.flowInput,
                nodeInput: node.input,
                parentOutput: node.parentOutput || parentOutput,
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
                await this._runWaitAnyBatch(options);
            }
            else if (index) {
                await this._runWaitAny(options);
            }
            else if (result.batch) {
                await this._runNodeBatch(options);
            }
            else {
                await this._runNodeSimple(options);
            }
        }
        catch (error) {
            this.stop(error);
        }
    }

    async _runWaitAny(options) {
        if (options.index === -1) {
            this._skipBatchNode(options);
        }
        else {
            const waitAny = new Batch({
                ...options.node,
                batchIndex: options.index,
                input: options.input,
                storage: options.storage
            });
            const batch = [waitAny];
            this._nodes.addBatch(waitAny);
            this._setTaskState(waitAny);
            await this._createJob(options, batch);
        }
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
            this._setTaskState(batch);
            this._createJob(batch);
        });
    }

    async _runNodeSimple(options) {
        const node = new Node({
            ...options.node,
            storage: options.storage,
            input: options.input
        });
        this._nodes.setNode(node);
        this._setTaskState(node);
        await this._createJob(options);
    }

    async _runNodeBatch(options) {
        if (options.input.length === 0) {
            this._skipBatchNode(options);
        }
        else {
            options.input.forEach((inp, ind) => {
                const batch = new Batch({
                    ...options.node,
                    batchIndex: (ind + 1),
                    input: inp.input,
                    storage: inp.storage
                });
                this._nodes.addBatch(batch);
                this._setTaskState(batch);
            });
            await this._createJob(options, options.node.batch);
        }
    }

    _skipBatchNode(options) {
        const node = new Batch({
            ...options.node,
            status: NodeStates.SKIPPED,
            batchIndex: -1,
        });
        this._nodes.addBatch(node);
        this._nodes.setNode({ nodeName: node.nodeName, result: [], status: NodeStates.SKIPPED });
        this._setTaskState(node);
        this._taskComplete(node.taskId);
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
        if (task.error && !task.execId) {
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

    _setTaskState(task) {
        if (!this._active) {
            return;
        }
        const { taskId, execId, status, error } = task;
        if (execId) {
            this._nodes.updateAlgorithmExecution(task);
        }
        else {
            this._nodes.updateTaskState(taskId, task);
        }
        if (error) {
            log.error(`task ${status} ${taskId}. error: ${error}`, { component, jobId: this._jobId, pipelineName: this.pipeline.name, taskId });
        }
        else {
            log.debug(`task ${status} ${taskId}`, { component, jobId: this._jobId, pipelineName: this.pipeline.name, taskId });
        }
        this._progress.debug({ jobId: this._jobId, pipeline: this.pipeline.name, status: DriverStates.ACTIVE });
        pipelineMetrics.setProgressMetric({ jobId: this._jobId, pipeline: this.pipeline.name, progress: this._progress.currentProgress, status: NodeStates.ACTIVE });
    }

    _createJob(options, batch) {
        let tasks = [];
        if (batch) {
            tasks = batch.map(b => ({ taskId: b.taskId, input: b.input, batchIndex: b.batchIndex, storage: b.storage }));
        }
        else {
            tasks.push({ taskId: options.node.taskId, input: options.node.input, storage: options.storage });
        }
        const jobOptions = {
            type: options.node.algorithmName,
            data: {
                tasks,
                jobId: this._jobId,
                nodeName: options.node.nodeName,
                pipelineName: this.pipeline.name,
                priority: this.pipeline.priority,
                algorithmName: options.node.algorithmName,
                info: {
                    extraData: options.node.extraData,
                    savePaths: options.paths,
                    lastRunResult: this.pipeline.lastRunResult
                }
            }
        };
        return producer.createJob(jobOptions);
    }
}

module.exports = TaskRunner;
