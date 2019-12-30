const EventEmitter = require('events');
const { parser } = require('@hkube/parsers');
const { NodesMap, NodeStates, NodeTypes } = require('@hkube/dag');
const logger = require('@hkube/logger');
const pipelineMetrics = require('../metrics/pipeline-metrics');
const producer = require('../producer/jobs-producer');
const StateManager = require('../state/state-manager');
const Progress = require('../progress/nodes-progress');
const DriverStates = require('../state/DriverStates');
const Events = require('../consts/Events');
const component = require('../consts/componentNames').TASK_RUNNER;
const graphStore = require('../datastore/graph-store');
const { PipelineReprocess, PipelineNotFound } = require('../errors');

const { Node, Batch } = NodeTypes;
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

    async _init(options) {
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
        this._stateManager.on(Events.JOBS.STOPPED, (d) => this._onStop(d));
        this._stateManager.on(Events.JOBS.PAUSED, (d) => this._onPause(d));
        this._stateManager.on('task-*', (task) => this._handleTaskEvent(task));
    }

    _onStop(data) {
        log.info(`pipeline ${data.status} ${this._jobId}. ${data.reason}`, { component, jobId: this._jobId, pipelineName: this.pipeline.name });
        this._jobStatus = data.status;
        this._driverStatus = DriverStates.READY;
        this.stop({ shouldStop: false });
    }

    _onPause(data) {
        log.info(`pipeline ${data.status} ${this._jobId}`, { component, jobId: this._jobId, pipelineName: this.pipeline.name });
        this._jobStatus = data.status;
        this._driverStatus = DriverStates.READY;
        this.stop({ shouldStop: false, shouldDeleteTasks: false });
    }

    _handleTaskEvent(task) {
        switch (task.status) {
            case NodeStates.STALLED: {
                const { error, ...rest } = task;
                const prevError = error;
                this._setTaskState({ prevError, ...rest });
                break;
            }
            case NodeStates.CRASHED: {
                const data = { ...task, endTime: Date.now(), status: NodeStates.FAILED };
                this._setTaskState(data);
                this._taskComplete(task);
                break;
            }
            case NodeStates.WARNING: {
                const { warning, ...rest } = task;
                const prevError = warning;
                this._setTaskState({ prevError, ...rest });
                break;
            }
            case NodeStates.ACTIVE:
                this._setTaskState(task);
                break;
            case NodeStates.FAILED:
            case NodeStates.SUCCEED:
                this._setTaskState(task);
                this._taskComplete(task);
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
            const shouldStop = e.status === null;
            await this.stop({ error: e, shouldStop });
        }
        return result;
    }

    async stop({ error, nodeName, shouldStop = true, shouldDeleteTasks = true } = {}) {
        if (!this._active) {
            return;
        }
        this._active = false;
        try {
            if (shouldStop) {
                await this._stopPipeline(error, nodeName);
            }
        }
        catch (e) {
            log.error(`unable to stop pipeline, ${e.message}`, { component, jobId: this._jobId }, e);
        }
        finally {
            if (shouldDeleteTasks) {
                await this._deleteTasks();
            }
            await this._unWatchJob();
            await this._cleanJob(error);
            await this._updateDiscovery();
        }
    }

    async _updateDiscovery() {
        try {
            await this._stateManager.updateDiscovery();
        }
        catch (e) {
            log.error(e.message, { component, jobId: this._jobId }, e);
        }
    }

    async _startPipeline(job) {
        this._job = job;
        this._jobId = job.data.jobId;
        this._jobStatus = DriverStates.ACTIVE;
        this._driverStatus = DriverStates.ACTIVE;
        log.info(`pipeline started ${this._jobId}`, { component, jobId: this._jobId });

        const jobStatus = await this._stateManager.watchJobStatus({ jobId: this._jobId });
        if (this._stateManager.isCompletedState(jobStatus)) {
            throw new PipelineReprocess(jobStatus.status);
        }

        const pipeline = await this._stateManager.getExecution({ jobId: this._jobId });
        if (!pipeline) {
            throw new PipelineNotFound(this._jobId);
        }

        await this._progressStatus({ status: DriverStates.ACTIVE });

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

        if (jobStatus.status !== DriverStates.PENDING) {
            const graph = await graphStore.getGraph({ jobId: this._jobId });
            if (!graph) {
                throw new Error('unable to find graph during recover process');
            }
            log.info(`starting recover process ${this._jobId}`, { component });
            this._recoverGraph(graph);
            await this._watchTasks();
            await this._recoverPipeline();
        }
        else {
            await this._watchTasks();
            this._runEntryNodes();
        }
        await graphStore.start(job.data.jobId, this._nodes);
        return this.pipeline;
    }

    async _stopPipeline(err, nodeName) {
        let status;
        let error;
        let data;
        if (err) {
            error = err.message;
        }
        else {
            data = this._nodes.pipelineResults();
        }

        const { storageError, storageResults } = await this._stateManager.setJobResultsToStorage({ jobId: this._jobId, data });

        if (error || storageError) {
            status = DriverStates.FAILED;
            error = storageError || error;
        }
        else {
            status = DriverStates.COMPLETED;
        }
        this._jobStatus = status;
        this._driverStatus = DriverStates.READY;
        this._error = error;
        await this._stateManager.setJobResults({ jobId: this._jobId, startTime: this.pipeline.startTime, pipeline: this.pipeline.name, data: storageResults, error, status, nodeName });
        await this._progressStatus({ status, error, nodeName });

        pipelineMetrics.endMetrics({ jobId: this._jobId, pipeline: this.pipeline.name, progress: this._currentProgress, status });
        log.info(`pipeline ${status}. ${error || ''}`, { component, jobId: this._jobId, pipelineName: this.pipeline.name });
    }

    _recoverGraph(graph) {
        graph.edges.forEach((e) => {
            this._nodes._graph.setEdge(e.from, e.to, e.edges);
        });
        graph.nodes.forEach((n) => {
            n.batch = n.batch || []; // eslint-disable-line
            this._nodes._graph.setNode(n.nodeName, n);
        });
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

    async _watchTasks() {
        await this._stateManager.watchTasks({ jobId: this._jobId });
    }

    async _unWatchJob() {
        try {
            await Promise.all([
                this._stateManager.unWatchJobStatus({ jobId: this._jobId }),
                this._stateManager.unWatchTasks({ jobId: this._jobId })
            ]);
        }
        catch (e) {
            log.error(e.message, { component, jobId: this._jobId }, e);
        }
    }

    async _deleteTasks() {
        try {
            await this._stateManager.deleteTasksList({ jobId: this._jobId });
        }
        catch (e) {
            log.error(e.message, { component, jobId: this._jobId }, e);
        }
    }

    async _progressStatus({ status, error, nodeName }) {
        if (error) {
            await this._progressError({ status, error, nodeName });
        }
        else {
            await this._progressInfo({ status });
        }
    }

    async _progressError({ status, error, nodeName }) {
        if (this._progress) {
            await this._progress.error({ jobId: this._jobId, pipeline: this.pipeline.name, status, error, nodeName });
        }
        else {
            await this._stateManager.setJobStatus({ jobId: this._jobId, pipeline: this.pipeline.name, status, error, nodeName, level: logger.Levels.ERROR.name });
        }
    }

    async _progressInfo({ status }) {
        if (this._progress) {
            await this._progress.info({ jobId: this._jobId, pipeline: this.pipeline.name, status });
        }
        else {
            await this._stateManager.setJobStatus({ jobId: this._jobId, pipeline: this.pipeline.name, status, level: logger.Levels.INFO.name });
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

    async _runNode(nodeName, parentOutput, index) {
        try {
            const node = this._nodes.getNode(nodeName);
            // TODO: resolve this issue in a better way
            if (node.status !== NodeStates.CREATING && node.status !== NodeStates.PRESCHEDULE) {
                return;
            }
            log.info(`node ${nodeName} is ready to run`, { component });
            this._checkPreschedule(nodeName);

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
            this.stop({ error, nodeName });
        }
    }

    async _checkPreschedule(nodeName) {
        const childs = this._nodes._childs(nodeName);
        await Promise.all(childs.map(c => this._sendPreschedule(c)));
    }

    async _sendPreschedule(nodeName) {
        const graphNode = this._nodes.getNode(nodeName);
        const node = new Node({ ...graphNode, status: NodeStates.PRESCHEDULE });
        const options = { node };
        this._nodes.setNode(node);
        this._setTaskState(node);
        log.info(`node ${nodeName} is in ${NodeStates.PRESCHEDULE}`, { component });
        await this._createJob(options);
    }

    async _runWaitAny(options) {
        if (options.index === -1) {
            this._skipBatchNode(options);
        }
        else {
            const { taskId, ...nodeBatch } = options.node;
            const waitAny = new Batch({
                ...nodeBatch,
                status: NodeStates.CREATING,
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
                status: NodeStates.CREATING,
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
            status: NodeStates.CREATING,
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
            // remove taskId from node so the batch will generate new ids
            const { taskId, ...nodeBatch } = options.node;
            options.input.forEach((inp, ind) => {
                const batch = new Batch({
                    ...nodeBatch,
                    status: NodeStates.CREATING,
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
        this._nodes.setNode({ nodeName: options.node.nodeName, result: [], status: NodeStates.SKIPPED });
        this._setTaskState(node);
        this._taskComplete(node);
    }

    _taskComplete(task) {
        if (!this._active) {
            return;
        }
        const error = this._checkTaskErrors(task);
        if (error) {
            this.stop({ error, nodeName: task.nodeName });
        }
        else {
            this._nodes.updateCompletedTask(task);

            if (this._nodes.isAllNodesCompleted()) {
                this.stop();
            }
        }
    }

    _checkTaskErrors(task) {
        let err;
        const { error, nodeName, reason, batchIndex, execId } = task;
        if (error && !execId) {
            // in case off image pull error, we want to fail the pipeline.
            if (reason === 'ImagePullBackOff' || reason === 'ErrImagePull') {
                err = new Error(`${reason}. ${error}`);
            }
            else if (batchIndex) {
                const { batchTolerance } = this.pipeline.options;
                const states = this._nodes.getNodeStates(nodeName);
                const failed = states.filter(s => s === NodeStates.FAILED);
                const percent = ((failed.length / states.length) * 100).toFixed(0);

                if (percent >= batchTolerance) {
                    err = new Error(`${failed.length}/${states.length} (${percent}%) failed tasks, batch tolerance is ${batchTolerance}%, error: ${error}`);
                }
            }
            else {
                err = new Error(error);
            }
        }
        return err;
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
            this._updateTaskState(taskId, task);
        }

        log.debug(`task ${status} ${taskId} ${error || ''}`, { component, jobId: this._jobId, pipelineName: this.pipeline.name, taskId });
        this._progress.debug({ jobId: this._jobId, pipeline: this.pipeline.name, status: DriverStates.ACTIVE });
        pipelineMetrics.setProgressMetric({ jobId: this._jobId, pipeline: this.pipeline.name, progress: this._progress.currentProgress, status: NodeStates.ACTIVE });
    }

    _updateTaskState(taskId, task) {
        const { status, result, error, reason, podName, prevError, retries, startTime, endTime, metricsPath } = task;
        const state = { status, result, error, reason, podName, prevError, retries, startTime, endTime, metricsPath };
        this._nodes.updateTaskState(taskId, state);
    }

    _createJob(options, batch) {
        let tasks = [];
        if (batch) {
            tasks = batch.map(b => ({ taskId: b.taskId, status: b.status, input: b.input, batchIndex: b.batchIndex, storage: b.storage }));
        }
        else {
            tasks.push({ taskId: options.node.taskId, status: options.node.status, input: options.node.input, storage: options.storage });
        }
        const jobOptions = {
            type: options.node.algorithmName,
            data: {
                tasks,
                jobId: this._jobId,
                nodeName: options.node.nodeName,
                metrics: options.node.metrics,
                pipelineName: this.pipeline.name,
                priority: this.pipeline.priority,
                algorithmName: options.node.algorithmName,
                info: {
                    extraData: options.node.extraData,
                    savePaths: options.paths,
                    lastRunResult: this.pipeline.lastRunResult,
                    rootJobId: this.pipeline.rootJobId
                }
            }
        };
        return producer.createJob(jobOptions);
    }
}

module.exports = TaskRunner;
