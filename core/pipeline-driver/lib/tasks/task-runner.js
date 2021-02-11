const EventEmitter = require('events');
const { parser } = require('@hkube/parsers');
const { pipelineStatuses, taskStatuses, stateType, pipelineKind } = require('@hkube/consts');
const { NodesMap, NodeTypes } = require('@hkube/dag');
const logger = require('@hkube/logger');
const pipelineMetrics = require('../metrics/pipeline-metrics');
const producer = require('../producer/jobs-producer');
const StateManager = require('../state/state-manager');
const Progress = require('../progress/nodes-progress');
const DriverStates = require('../state/DriverStates');
const commands = require('../consts/commands');
const Boards = require('../boards/boards');
const component = require('../consts/componentNames').TASK_RUNNER;
const graphStore = require('../datastore/graph-store');
const cachePipeline = require('./cache-pipeline');
const uniqueDiscovery = require('../helpers/discovery');
const { PipelineReprocess, PipelineNotFound } = require('../errors');
const { Node, Batch } = NodeTypes;
const shouldRunTaskStates = [taskStatuses.CREATING, taskStatuses.PRESCHEDULE, taskStatuses.FAILED_SCHEDULING];
const activeTaskStates = [taskStatuses.CREATING, taskStatuses.ACTIVE, taskStatuses.PRESCHEDULE];
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
        this._isStreaming = false;
        this._schedulingWarningTimeoutMs = options.unScheduledAlgorithms.warningTimeoutMs;
        this._init(options);
    }

    async _init(options) {
        if (!log) {
            log = logger.GetLogFromContainer();
        }
        this._stateManager = new StateManager({
            ...options,
            discoveryMethod: this._getDiscoveryData.bind(this)
        });
        this._stateManager.on(commands.stopProcessing, (data) => {
            this.emit(commands.stopProcessing, data);
        });
        this._stateManager.on(`job-${pipelineStatuses.STOPPED}`, (d) => this._onStop(d));
        this._stateManager.on(`job-${pipelineStatuses.PAUSED}`, (d) => this._onPause(d));
        this._stateManager.on('task-changed', (task) => this._handleTaskEvent(task));
        this._stateManager.on('events-warning', (event) => this._handleEvents(event));
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
            case taskStatuses.STALLED: {
                const { error, ...rest } = task;
                const warning = error;
                this._setTaskState({ warning, ...rest });
                break;
            }
            case taskStatuses.CRASHED: {
                const data = { ...task, endTime: Date.now(), status: taskStatuses.FAILED };
                this._setTaskState(data);
                this._onTaskError(task);
                break;
            }
            case taskStatuses.WARNING: {
                this._setTaskState(task);
                break;
            }
            case taskStatuses.ACTIVE:
                this._setTaskState(task);
                break;
            case taskStatuses.STORING:
                this._setTaskState(task);
                this._onStoring(task);
                break;
            case taskStatuses.FAILED:
                this._setTaskState(task);
                this._onTaskError(task);
                break;
            case taskStatuses.SUCCEED:
                this._setTaskState(task);
                this._onTaskComplete(task);
                break;
            case taskStatuses.THROUGHPUT:
                this._onStreamingMetrics(task);
                break;
            default:
                log.warning(`invalid task status ${task.status}`, { component, jobId: this._jobId });
                break;
        }
    }

    _handleEvents(event) {
        if (!this._nodes) {
            return;
        }
        const nodes = this._nodes.getAllNodes().filter(n => this._filterTasksByEvent(n, event));
        if (nodes.length === 0) {
            return;
        }

        log.warning(`found event ${event.reason} for algorithm ${event.algorithmName}`);
        nodes.forEach(n => {
            const batch = n.batch.filter(b => this._filterTasksByEvent(b, event));
            batch.forEach(b => {
                b.status = event.reason;
            });
            n.status = event.reason;
            n.warnings = n.warnings || [];
            n.warnings.push(event.message);
        });
        this._progressStatus({ status: DriverStates.ACTIVE });
    }

    _filterTasksByEvent(task, event) {
        return task.algorithmName === event.algorithmName
            && task.status === taskStatuses.CREATING
            && (Date.now() - event.timestamp > this._schedulingWarningTimeoutMs || event.hasMaxCapacity);
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
            const shouldStop = e.status === undefined;
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
            await this._deleteStreamingStats();
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
        this._isCachedPipeline = await cachePipeline._checkCachePipeline(pipeline.nodes);

        this.pipeline = pipeline;
        this._isStreaming = pipeline.kind === pipelineKind.Stream;
        this._nodes = new NodesMap(this.pipeline, { validateNodesRelations: !this._isCachedPipeline });
        this._nodes.on('node-ready', (node) => {
            this._runNode(node.nodeName, node.parentOutput, node.index);
        });
        this._progress = new Progress({
            type: this.pipeline.kind,
            getGraphNodes: (...args) => this._nodes._getNodesAsFlat(...args),
            getGraphEdges: (...args) => this._nodes.getEdges(...args),
            sendProgress: (...args) => this._stateManager.setJobStatus(...args)
        });

        this._boards = new Boards({ types: pipeline.types, updateBoard: (task) => this._stateManager.updatePipeline(task) });

        pipelineMetrics.startMetrics({ jobId: this._jobId, pipeline: this.pipeline.name, spanId: this._job.data && this._job.data.spanId });
        const graph = await graphStore.getGraph({ jobId: this._jobId });

        if (jobStatus.status !== DriverStates.PENDING && graph) {
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
        this._stateManager.checkUnScheduledAlgorithms();
        return this.pipeline;
    }

    async _stopPipeline(err, nodeName) {
        let status;
        let error;
        let data;
        if (err) {
            error = err.message;
            const nodes = this._nodes._getNodesAsFlat();
            nodes.forEach((n) => {
                if (activeTaskStates.includes(n.status)) {
                    n.status = pipelineStatuses.STOPPED;
                }
            });
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
            this._nodes.setEdge(e.from, e.to, e.value);
        });
        graph.nodes.forEach((n) => {
            const pNode = this.pipeline.nodes.find(p => p.nodeName === n.nodeName);
            const node = {
                ...n,
                ...pNode,
                batch: n.batch || [],
                input: n.input,
                result: n.output
            };
            node.batch.forEach(b => {
                b.result = b.output;
            });
            this._nodes._graph.setNode(node.nodeName, node);
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
                tasksGraph.forEach((gTask) => {
                    const sTask = tasks.get(gTask.taskId);
                    if (sTask && sTask.status !== gTask.status) {
                        const task = {
                            ...gTask,
                            ...sTask
                        };
                        if (task.status === taskStatuses.SUCCEED && gTask.status !== taskStatuses.STORING) {
                            this._setTaskState(task);
                            this._onStoring(task);
                            this._onTaskComplete(task);
                        }
                        else {
                            this._handleTaskEvent(task);
                        }
                    }
                });
            }
        }
    }

    _runEntryNodes() {
        const entryNodes = this._findEntryNodes();
        if (entryNodes.length === 0) {
            throw new Error('unable to find entry nodes');
        }
        entryNodes.forEach(n => this._runNode(n));
    }

    _findEntryNodes() {
        const sourceNodes = this._nodes.getSources();
        const statefulNodes = this._nodes.getAllNodes().filter(n => n.stateType === stateType.Stateful).map(n => n.nodeName);
        return [...new Set([...sourceNodes, ...statefulNodes])];
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

    async _deleteStreamingStats() {
        try {
            await this._stateManager.deleteStreamingStats({ jobId: this._jobId });
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
        await this._updateDiscovery();
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
        this._stateManager.unCheckUnScheduledAlgorithms();
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
        this._nodeRuns = new Set();
        this._preScheduledNodes = new Set();
    }

    async _runNode(nodeName, parentOutput, index) {
        try {
            const node = this._nodes.getNode(nodeName);
            // TODO: resolve this issue in a better way
            if (!shouldRunTaskStates.includes(node.status)) {
                log.warning(`node ${nodeName} cannot run, status: ${node.status}`, { component });
                return;
            }
            if (!index && this._nodeRuns.has(nodeName)) {
                log.error(`node ${nodeName} was already running, status: ${node.status}`, { component });
                return;
            }
            this._nodeRuns.add(nodeName);

            log.info(`node ${nodeName} is ready to run`, { component });
            this._checkPreSchedule(nodeName);

            const parse = {
                flowInputMetadata: this.pipeline.flowInputMetadata,
                nodeInput: node.input,
                parentOutput: node.parentOutput || parentOutput,
                batchOperation: node.batchOperation,
                ignoreParentResult: node.stateType === stateType.Stateful,
                index
            };
            const result = parser.parse(parse);
            const paths = this._nodes.extractPaths(nodeName);
            const parents = this._nodes._parents(nodeName);
            const childs = this._nodes._childs(nodeName);

            const options = {
                node,
                index,
                paths,
                parents,
                childs,
                input: result.input,
                storage: result.storage
            };

            if (!this._isCachedPipeline) {
                uniqueDiscovery(result.storage);
            }

            if (result.batch) {
                await this._runNodeBatch(options);
            }
            else if (index) {
                await this._runWaitAny(options);
            }
            else {
                await this._runNodeSimple(options);
            }
        }
        catch (error) {
            this.stop({ error, nodeName });
        }
    }

    async _checkPreSchedule(nodeName) {
        const childs = this._nodes._childs(nodeName);
        await Promise.all(childs.map(c => this._sendPreSchedule(c)));
    }

    async _sendPreSchedule(nodeName) {
        if (this._preScheduledNodes.has(nodeName)) {
            return;
        }
        this._preScheduledNodes.add(nodeName);
        const graphNode = this._nodes.getNode(nodeName);
        const node = new Node({ ...graphNode, status: taskStatuses.PRESCHEDULE });
        const options = { node };
        this._nodes.setNode(node);
        this._setTaskState(node);
        log.info(`node ${nodeName} is in ${taskStatuses.PRESCHEDULE}`, { component });
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
                status: taskStatuses.CREATING,
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

    async _runNodeSimple(options) {
        const node = new Node({
            ...options.node,
            status: taskStatuses.CREATING,
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
            const batchList = [];
            options.input.forEach((inp, ind) => {
                const batch = new Batch({
                    ...nodeBatch,
                    status: taskStatuses.CREATING,
                    batchIndex: (ind + 1),
                    input: inp.input,
                    storage: inp.storage
                });
                batchList.push(batch);
            });
            this._nodes.addBatchList(nodeBatch.nodeName, batchList);
            this._progress.debug({ jobId: this._jobId, pipeline: this.pipeline.name, status: DriverStates.ACTIVE });
            await this._createJob(options, batchList);
        }
    }

    _skipBatchNode(options) {
        const node = new Batch({
            ...options.node,
            status: taskStatuses.SKIPPED,
            batchIndex: -1,
        });
        this._nodes.addBatch(node);
        this._nodes.setNode({ nodeName: options.node.nodeName, result: [], status: taskStatuses.SKIPPED });
        this._setTaskState(node);
        this._updateAndCheckAllTask(node);
    }

    _onTaskError(task) {
        if (!this._active || this._isStreaming) {
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

    _updateAndCheckAllTask(task) {
        if (!this._active) {
            return;
        }
        this._nodes.updateCompletedTask(task);

        if (this._nodes.isAllNodesCompleted()) {
            this.stop();
        }
    }

    _onStreamingMetrics(task) {
        if (!this._active) {
            return;
        }
        task.metrics.forEach((t) => {
            const { source, target, requests, responses, dropped, ...metrics } = t;
            const edge = this._nodes.getEdge(t.source, t.target);
            let { totalRequests = 0, totalResponses = 0, totalDropped = 0 } = edge.metrics || {};
            totalRequests += requests;
            totalResponses += responses;
            totalDropped += dropped;
            this._nodes.updateEdge(source, target, { metrics: { ...metrics, totalRequests, totalResponses, totalDropped } });
        });
        this._progress.debug({ jobId: this._jobId, pipeline: this.pipeline.name, status: DriverStates.ACTIVE });
    }

    _onStoring(task) {
        if (!this._active) {
            return;
        }
        if (!this._isStreaming) {
            this._nodes.updateCompletedTask(task);
        }
    }

    _onTaskComplete(task) {
        if (!this._active) {
            return;
        }
        if (this._isStreamingDone(task)) {
            this.stop();
        }
        else if (this._nodes.isAllNodesCompleted()) {
            this.stop();
        }
    }

    _isStreamingDone(task) {
        return this._isStreaming && task.isStateful;
    }

    _checkTaskErrors(task) {
        let err;
        const { error, nodeName, isImagePullErr, batchIndex, execId } = task;
        if (error && !execId) {
            // in case off image pull error, we want to fail the pipeline.
            if (isImagePullErr) {
                err = new Error(error);
            }
            else if (batchIndex) {
                const { batchTolerance } = this.pipeline.options;
                const states = this._nodes.getNodeStates(nodeName);
                const failed = states.filter(s => s === taskStatuses.FAILED);
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
        const { taskId, execId, isScaled, status, error } = task;
        let taskRemoved = false;
        if (execId) {
            this._nodes.updateAlgorithmExecution(task);
        }
        else if (isScaled) {
            if (status === taskStatuses.ACTIVE) {
                this._nodes.addTaskToBatch(task);
            }
            else {
                this._nodes.removeTaskFromBatch(task);
                taskRemoved = true;
            }
        }
        if (!taskRemoved) {
            this._updateTaskState(taskId, task);
        }

        log.debug(`task ${status} ${taskId} ${error || ''}`, { component, jobId: this._jobId, pipelineName: this.pipeline.name, taskId });
        this._progress.debug({ jobId: this._jobId, pipeline: this.pipeline.name, status: DriverStates.ACTIVE });
        this._boards.update(task);
        pipelineMetrics.setProgressMetric({ jobId: this._jobId, pipeline: this.pipeline.name, progress: this._progress.currentProgress, status: taskStatuses.ACTIVE });
    }

    _updateTaskState(taskId, task) {
        const { status, result, error, reason, podName, warning, retries, startTime, endTime, metricsPath } = task;
        const state = { status, result, error, reason, podName, warning, retries, startTime, endTime, metricsPath };
        this._nodes.updateTaskState(taskId, state);
    }

    async _createJob(options, batch) {
        return producer.createJob({ jobId: this._jobId, pipeline: this.pipeline, options, batch });
    }
}

module.exports = TaskRunner;
