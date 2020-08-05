const EventEmitter = require('events');
const { NodesMap } = require('@hkube/dag');
const { stateType } = require('@hkube/consts');
const { parser } = require('@hkube/parsers');
const Logger = require('@hkube/logger');
const producer = require('../producer/producer');
const setting = require('./setting.json');
const stateAdapter = require('../states/stateAdapter');
const metrics = require('./metrics');
const discovery = require('./service-discovery');
const Statistics = require('./statistics');
const Progress = require('./progress');
const { Components } = require('../consts');
const component = Components.AUTO_SCALER;
let log;

/**
 * TODO:
 * ✔️ - Handle Scale down
 * ✔️ - Add progress
 * ✔️ - Create jobs
 * ✔️ - Add fixed size window
 * discovery by node connected to node a --> b (unique)
 * handle range minRatioToScaleUp: 1.2 minRatioToScaleDown: 0.8
 */

class AutoScaler extends EventEmitter {
    init(options) {
        this._options = options;
        log = Logger.GetLogFromContainer();

        discovery.on('changed', (changes) => {
            this.emit('discovery-changed', changes);
        });
    }

    async start(jobData) {
        this._active = true;
        this._jobData = jobData;
        this._statistics = new Statistics(this._options.streaming.autoScaler.maxSizeWindow);
        this._progress = new Progress();
        this._progress.on('changed', (changes) => {
            this.emit('progress-changed', changes);
        });
        this._sentJobs = Object.create(null);
        await discovery.start({ jobId: jobData.jobId, taskId: jobData.taskId });
        this._pipeline = await stateAdapter.getExecution({ jobId: jobData.jobId });
        this._dag = new NodesMap(this._pipeline);
        this._autoScaleInterval();
    }

    finish() {
        this._active = false;
        discovery.finish();
        clearInterval(this._interval);
        this._interval = null;
    }

    report(data) {
        if (!this._active) {
            return;
        }
        data.forEach((d) => {
            const node = this._pipeline.nodes.find(n => n.nodeName === d.nodeName && n.stateType === stateType.Stateless);
            if (node) {
                this._statistics.report(d);
            }
        });
    }

    _autoScaleInterval() {
        if (this._interval) {
            return;
        }
        this._interval = setInterval(() => {
            if (this._activeInterval) {
                return;
            }
            try {
                this._activeInterval = true;
                this.autoScale();
                this.checkProgress();
            }
            catch (e) {
                log.throttle.error(e.message, { component });
            }
            finally {
                this._activeInterval = false;
            }
        }, this._options.streaming.autoScaler.interval);
    }

    checkProgress() {
        return this._progress.check();
    }

    autoScale() {
        const { scaleUp, scaleDown } = this._createScale(this._statistics.data);
        this._createJobs(scaleUp);
        this._scaleDown(scaleDown);
        return { scaleUp, scaleDown };
    }

    _createScale(statistics) {
        const scaleUp = [];
        const scaleDown = [];

        Object.values(statistics).forEach((v) => {
            const { nodeName } = v;
            let replicasUp = 0;
            let replicasDown = 0;
            const currentSize = v.currentSize || 1;
            const response = [];

            setting.metrics.forEach((m) => {
                const metric = metrics[m.type];
                const { reqRate, resRate } = metric(v, m);
                const ratio = reqRate / resRate;
                const progress = resRate / reqRate;
                this._progress.update(nodeName, progress);

                if (ratio >= m.minRatioToScaleUp) {
                    const sentJob = this._sentJobs[nodeName];
                    if (!sentJob || sentJob.replicas < currentSize) {
                        const scaleSize = Math.ceil(currentSize * ratio);
                        response.push({ metric: m.type, scaleSize });
                        replicasUp += Math.min(scaleSize, m.maxReplicas);
                    }
                    else if (sentJob && sentJob.replicas <= currentSize) {
                        delete this._sentJobs[nodeName];
                    }
                }
                else if (ratio <= m.minRatioToScaleDown && currentSize > m.minSizeForScaleDown) {
                    const scaleSize = Math.floor(currentSize * ratio);
                    replicasDown += scaleSize;
                }
            });

            replicasUp = Math.min(replicasUp, setting.spec.max);
            if (replicasUp > 0) {
                const scaleLog = response.map(m => `${m.metric}:${m.scaleSize}`).join(',');
                log.info(`scaling up ${replicasUp} replicas for node ${nodeName} with metrics ${scaleLog}`, { component });
                scaleUp.push({ nodeName, replicas: replicasUp });
                this._sentJobs[nodeName] = { replicas: replicasUp };
            }
            if (replicasDown > 0) {
                log.info(`scaling down ${replicasDown} replicas for node ${nodeName} with`, { component });
                scaleDown.push({ nodeName, replicas: replicasDown });
            }
        });
        return { scaleUp, scaleDown };
    }

    _createJobs(jobList) {
        jobList.forEach((j) => {
            const { nodeName, replicas } = j;
            const tasks = [];
            const node = this._pipeline.nodes.find(n => n.nodeName === nodeName);
            const parse = {
                flowInputMetadata: this._pipeline.flowInputMetadata,
                nodeInput: node.input,
                ignoreParentResult: true
            };
            const result = parser.parse(parse);
            for (let i = 0; i < replicas; i += 1) {
                const taskId = producer.createTaskID();
                const task = { taskId, input: result.input, storage: result.storage, batchIndex: i + 1 };
                tasks.push(task);
            }
            const parents = this._dag._parents(nodeName);
            const childs = this._dag._childs(nodeName);
            const job = {
                ...this._jobData,
                ...node,
                tasks,
                parents,
                childs
            };
            producer.createJob({ jobData: job });
        });
    }

    _scaleDown(scaleDown) {
        scaleDown.forEach(async (j) => {
            const { nodeName, replicas } = j;
            const instances = discovery.getInstances(nodeName);
            if (instances.length < replicas) {
                log.warn();
            }
            else {
                const workers = instances.slice(0, replicas);
                await Promise.all(workers.map(w => stateAdapter.stopWorker(w.workerId)));
            }
        });
    }
}

module.exports = new AutoScaler();
