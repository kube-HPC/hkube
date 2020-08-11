const EventEmitter = require('events');
const { NodesMap } = require('@hkube/dag');
const { stateType } = require('@hkube/consts');
const { parser } = require('@hkube/parsers');
const Logger = require('@hkube/logger');
const producer = require('../producer/producer');
const setting = require('./setting.json');
const stateAdapter = require('../states/stateAdapter');
const { reqResRatioMetric } = require('./metrics');
const discovery = require('./service-discovery');
const Statistics = require('./statistics');
const Progress = require('./progress');
const { Components, streamingEvents } = require('../consts');
const component = Components.AUTO_SCALER;
let log;

/**
 * TODO:
 * ✔️ - Handle Scale down
 * ✔️ - Add progress
 * ✔️ - Create jobs
 * ✔️ - Add fixed size window
 * ✔️ - Add/Remove stateless on graph
 * - discovery by node connected to node a --> b (unique)
 * - handle range minRatioToScaleUp: 1.2 minRatioToScaleDown: 0.8
 */

class AutoScaler extends EventEmitter {
    init(options) {
        this._options = options;
        log = Logger.GetLogFromContainer();

        discovery.on('changed', (changed) => {
            const nodes = this._jobData.parents;
            const changes = changed.filter(c => nodes.indexOf(c.nodeName) !== -1);
            if (changes.length > 0) {
                this.emit(streamingEvents.DISCOVERY_CHANGED, changes);
            }
        });
    }

    async start(jobData) {
        this._active = true;
        this._jobData = jobData;
        this._statistics = new Statistics(this._options.streaming.autoScaler.maxSizeWindow);
        this._progress = new Progress();
        this._progress.on('changed', (changes) => {
            this.emit(streamingEvents.PROGRESS_CHANGED, changes);
        });
        this._pendingScale = Object.create(null);
        await discovery.start({ jobId: jobData.jobId, taskId: jobData.taskId });
        this._pipeline = await stateAdapter.getExecution({ jobId: jobData.jobId });
        this._nodes = this._pipeline.nodes.reduce((acc, cur) => {
            acc[cur.nodeName] = { isStateful: cur.stateType === stateType.Stateful, ...cur };
            return acc;
        }, {});
        this._dag = new NodesMap(this._pipeline);
        this._autoScaleInterval();
    }

    finish() {
        this._active = false;
        discovery.finish();
        clearInterval(this._interval);
        this._interval = null;
    }

    reportStats(data) {
        if (!this._active) {
            return;
        }
        data.forEach((d) => {
            this._statistics.report(d);
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
        this._scaleUp(scaleUp);
        this._scaleDown(scaleDown);
        return { scaleUp, scaleDown };
    }

    _createScale(statistics) {
        const scaleUp = [];
        const scaleDown = [];

        Object.values(statistics).forEach((v) => {
            const { nodeName } = v;
            const currentSize = v.currentSize || 1;
            const pendingScale = this._getPendingScale(nodeName, currentSize);
            const { reqResRatio, durationsRatio, reqRate, resRate } = reqResRatioMetric(v, setting);

            this._updateProgress(resRate, reqRate, nodeName);

            if (this._nodes[nodeName].isStateful) {
                return;
            }
            const { replicasUp, replicasDown } = this._getScaleAmount(reqResRatio, currentSize, pendingScale);
            this._updateScale(nodeName, currentSize, reqResRatio, replicasUp, replicasDown, scaleUp, scaleDown, pendingScale);
        });
        return { scaleUp, scaleDown };
    }

    _updateProgress(resRate, reqRate, nodeName) {
        if (resRate && reqRate) {
            const progress = parseFloat((resRate / reqRate).toFixed(2));
            this._progress.update(nodeName, progress);
            // log.info(`progress: ${progress}`, { component });
        }
    }

    _getPendingScale(nodeName, currentSize) {
        this._pendingScale[nodeName] = this._pendingScale[nodeName] || { up: 0, down: 0 };
        const pendingScale = this._pendingScale[nodeName];
        if (pendingScale.up <= currentSize) {
            if (!pendingScale.upTime) {
                pendingScale.upTime = Date.now();
            }
            if (Date.now() - pendingScale.upTime >= 10000) {
                pendingScale.up = 0;
            }
        }

        pendingScale.down = pendingScale.down >= currentSize ? 0 : pendingScale.down;
        return pendingScale;
    }

    _getScaleAmount(ratio, currentSize, pendingScale) {
        let replicasUp = 0;
        let replicasDown = 0;
        if (this._shouldScaleUp(ratio, setting, currentSize, pendingScale)) {
            const scaleSize = Math.ceil(currentSize * ratio);
            replicasUp = Math.min(scaleSize, setting.maxReplicas);
        }
        else if (this._shouldScaleDown(ratio, setting, currentSize, pendingScale)) {
            const scaleSize = Math.ceil(currentSize * ratio);
            replicasDown = scaleSize;
        }
        return { replicasUp, replicasDown };
    }

    _updateScale(nodeName, currentSize, ratio, replicasUp, replicasDown, scaleUp, scaleDown, pendingScale) {
        if (replicasUp > 0) {
            const replicas = Math.min(replicasUp, setting.max);
            log.info(`scaling up ${replicasUp} replicas for node ${nodeName} based on ${ratio} ratio`, { component });
            scaleUp.push({ nodeName, replicas });
            pendingScale.up = replicasUp; // eslint-disable-line
        }
        if (replicasDown > 0) {
            const replicas = Math.min(replicasDown, currentSize);
            log.info(`scaling down ${replicasDown} replicas for node ${nodeName} based on ${ratio} ratio`, { component });
            scaleDown.push({ nodeName, replicas });
            pendingScale.down = Math.max(0, currentSize - replicas); // eslint-disable-line
        }
    }

    _shouldScaleUp(ratio, metric, currentSize, pendingScale) {
        return ratio >= metric.minRatioToScaleUp && pendingScale.up < currentSize;
    }

    _shouldScaleDown(ratio, metric, currentSize, pendingScale) {
        return ratio <= metric.minRatioToScaleDown
            && currentSize >= metric.minReplicasToScaleDown
            && pendingScale.down === 0;
    }

    _scaleUp(jobList) {
        jobList.forEach((j) => {
            const { nodeName, replicas } = j;
            const tasks = [];
            const node = this._nodes[nodeName];
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
                childs,
                isScaled: true
            };
            producer.createJob({ jobData: job });
        });
    }

    _scaleDown(scaleDown) {
        scaleDown.forEach(async (j) => {
            const { nodeName, replicas } = j;
            const instances = discovery.getInstances(nodeName);
            const workers = instances.slice(0, replicas);
            await Promise.all(workers.map(w => stateAdapter.stopWorker(w.workerId)));
        });
    }
}

module.exports = new AutoScaler();
