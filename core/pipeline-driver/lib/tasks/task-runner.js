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
const Batch = require('../nodes/node-batch');
const Node = require('../nodes/node');
const component = require('../consts/componentNames').TASK_RUNNER;
const graphStore = require('../datastore/graph-store');

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
        this._init(options);
    }

    _init(options) {
        if (!log) {
            log = logger.GetLogFromContainer();
        }
        this._stateManager = new StateManager({ etcd: options.etcd, serviceName: options.serviceName, podName: options.kubernetes.podName });
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
                this._setTaskState(task.taskId, { status: NodeStates.STALLED, error: task.error });
                break;
            case NodeStates.ACTIVE:
                this._setTaskState(task.taskId, { status: NodeStates.ACTIVE });
                break;
            case NodeStates.FAILED:
            case NodeStates.SUCCEED:
                this._setTaskState(task.taskId, { status: task.status, error: task.error, result: task.result });
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
            result = await this._startPipeline(job);
        }
        catch (e) {
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
        if (this._isCompletedState(jobStatus)) {
            throw new Error(`pipeline already in ${jobStatus.status} status`);
        }

        const pipeline = await this._stateManager.getExecution({ jobId: this._jobId });
        if (!pipeline) {
            throw new Error(`unable to find pipeline for job ${this._jobId}`);
        }

        await this._watchJobState();

        this.pipeline = pipeline;
        this._nodes = new NodesMap(this.pipeline, this._jobId);
        this._nodes.on('node-ready', (node) => {
            log.debug(`new node ready to run: ${node.nodeName}`, { component });
            this._runNode(node.nodeName, node.parentOutput, node.index);
        });
        this._progress = new Progress({
            calcProgress: this._nodes.calcProgress,
            sendProgress: this._stateManager.setJobStatus,
            discoveryMethod: this._getDiscoveryData.bind(this)
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
            const entryNodes = this._nodes.findEntryNodes();

            if (entryNodes.length === 0) {
                throw new Error('unable to find entry nodes');
            }
            await this._watchTasks();
            entryNodes.forEach(n => this._runNode(n));
        }
        await graphStore.start(job.data.jobId, this._nodes);
        return this.pipeline;
    }

    async _stopPipeline(err, reason) {
        let status;
        let errorMsg;
        let data;
        if (err) {
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
        this._driverStatus = status;
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

    _isCompletedState(jobStatus) {
        return (jobStatus) && (jobStatus.status === DriverStates.COMPLETED || jobStatus.status === DriverStates.FAILED || jobStatus.status === DriverStates.STOPPED);
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
            jobId: this._jobId,
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
        this._job && this._job.done(error);
        this._job = null;
        this._jobId = null;
        this._error = null;
        this._driverStatus = null;
        this._jobStatus = null;
        this._stateManager.close();
        this._stateManager = null;
        this._progress = null;
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
        }
    }

    _runNode(nodeName, parentOutput, index) {
        try {
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
        catch (error) {
            this.stop(error);
        }
    }

    _runWaitAny(options) {
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
            this._setTaskState(waitAny.taskId, waitAny);
            this._createJob(options, batch);
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
            this._setTaskState(batch.taskId, batch);
            this._createJob(batch);
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
                this._setTaskState(batch.taskId, batch);
            });
            this._createJob(options, options.node.batch);
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
        this._setTaskState(node.taskId, node);
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
                    lastRunResult: options.node.lastRunResult
                }
            }
        };
        return producer.createJob(jobOptions);
    }
}

module.exports = TaskRunner;
