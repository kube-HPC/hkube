const EventEmitter = require('events');
const { NodesMap } = require('@hkube/dag');
const { stateType } = require('@hkube/consts');
const { parser } = require('@hkube/parsers');
const Logger = require('@hkube/logger');
const producer = require('../producer/producer');
const stateAdapter = require('../states/stateAdapter');
const { calcRates } = require('./metrics');
const discovery = require('./service-discovery');
const Statistics = require('./statistics');
const Progress = require('./progress');
const PendingScale = require('./pending-scale');
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
 * - handle sync between parents
 */

/**
* Ratio example:
* ratio = (req msgPer sec / res msgPer sec)
* (300 / 120) = 2.5
* If the response is 2.5 times slower than request
* So we need to scale up current replicas * 2.5
* If the ratio is 0.5 we need to scale down.
* The desired ratio is approximately 1 (0.8 <= desired <= 1.2)
*/

class AutoScaler extends EventEmitter {
    init(options) {
        this._options = options.streaming.autoScaler;
        log = Logger.GetLogFromContainer();
    }

    async start(jobData) {
        this._jobData = jobData;
        this._pipeline = await stateAdapter.getExecution({ jobId: jobData.jobId });
        this.run();
        this._autoScaleInterval();
    }

    run() {
        this._statistics = new Statistics(this._options);
        this._progress = new Progress();
        this._progress.on(streamingEvents.PROGRESS_CHANGED, (changes) => {
            this.emit(streamingEvents.PROGRESS_CHANGED, changes);
        });
        this._pendingScale = new PendingScale(this._options);
        this._nodes = this._pipeline.nodes.reduce((acc, cur) => {
            acc[cur.nodeName] = { isStateful: cur.stateType === stateType.Stateful, ...cur };
            return acc;
        }, {});
        this._dag = new NodesMap(this._pipeline);
        this._active = true;
    }

    election() {
        const { jobId, nodeName } = this._jobData;
        const childs = this._dag._childs(nodeName);
        childs.forEach(c => {
            const key = `${jobId}/${c}`;


        });
    }

    finish() {
        this._active = false;
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
        }, this._options.interval);
    }

    checkProgress() {
        return this._progress.check();
    }

    autoScale() {
        const { scaleUp, scaleDown } = this._createScale();
        this._scaleUp(scaleUp);
        this._scaleDown(scaleDown);
        return { scaleUp, scaleDown };
    }

    _createScale() {
        const scaleUp = [];
        const scaleDown = [];

        Object.values(this._statistics.data).forEach((stats) => {
            const { nodeName, currentSize } = stats;
            const { reqRate, resRate, durationsRate } = calcRates(stats, this._options);

            this._updateProgress(nodeName, reqRate, resRate);

            if (this._nodes[nodeName].isStateful) {
                return;
            }
            if (!reqRate && !resRate && !durationsRate) {
                return;
            }
            this._updateScale(nodeName, reqRate, resRate, durationsRate, currentSize, scaleUp, scaleDown);
        });
        return { scaleUp, scaleDown };
    }

    _updateProgress(nodeName, reqRate, resRate) {
        if (reqRate && resRate) {
            const progress = parseFloat((resRate / reqRate).toFixed(2));
            this._progress.update(nodeName, progress);
        }
    }

    _updateScale(nodeName, reqRate, resRates, durationsRates, currentSize, scaleUp, scaleDown) {
        let resRate = resRates;
        let durationsRate = durationsRates;
        let hasResRate = true;

        this._printRatesStats(reqRate, resRate, durationsRates);

        if (!resRate) {
            resRate = reqRate;
            hasResRate = false;
        }
        if (!durationsRate) {
            durationsRate = reqRate;
        }
        const reqResRatio = reqRate / resRate;
        const durationsRatio = reqRate / durationsRate;

        const pendingScale = this._pendingScale.check(nodeName, currentSize);

        if (this._shouldScaleUp(reqResRatio, this._options, pendingScale, hasResRate)) {
            const scaleSize = this._calcSize(currentSize, reqResRatio);
            const replicasUp = Math.min(scaleSize, this._options.maxReplicas);
            const scaleTo = currentSize + replicasUp;
            this._logScaling('up', nodeName, currentSize, scaleTo, reqResRatio);
            scaleUp.push({ nodeName, replicas: replicasUp });
            this._pendingScale.updateUp(nodeName, replicasUp);
        }
        else if (this._shouldScaleDown(durationsRatio, this._options, currentSize, pendingScale)) {
            const scaleSize = this._calcSize(currentSize, durationsRatio);
            const replicasDown = Math.min(scaleSize, currentSize);
            const scaleTo = currentSize - replicasDown;
            this._logScaling('down', nodeName, currentSize, scaleTo, durationsRatio);
            scaleDown.push({ nodeName, replicas: replicasDown });
            this._pendingScale.updateDown(nodeName, scaleTo);
        }
    }

    _printRatesStats(req, res, durations) {
        if (!this._lastPrint || Date.now() - this._lastPrint >= 30000) {
            log.info(`rates stats: req=${req.toFixed(2)}, res=${res.toFixed(2)}, durations=${durations.toFixed(2)}`, { component });
            this._lastPrint = Date.now();
        }
    }

    _calcSize(currentSize, ratio) {
        const size = currentSize || 1;
        return Math.ceil(size * ratio);
    }

    _logScaling(action, nodeName, currentSize, replicas, ratio) {
        log.info(`scaling ${action} from ${currentSize} to ${replicas} replicas for node ${nodeName} based on ${ratio.toFixed(3)} ratio`, { component });
    }

    _shouldScaleUp(reqResRatio, metric, pendingScale, hasResRate) {
        return pendingScale.upCount === null
            && ((reqResRatio >= metric.minRatioToScaleUp) || (!hasResRate && reqResRatio > 0));
    }

    _shouldScaleDown(durationsRatio, metric, currentSize, pendingScale) {
        return pendingScale.downTo === null
            && currentSize > metric.minReplicasToScaleDown
            // && reqResRatio >= metric.minRatioToScaleDown
            // && reqResRatio <= metric.minRatioToScaleUp
            && durationsRatio <= metric.minRatioToScaleDown; // todo: scale from 1 to 0
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
