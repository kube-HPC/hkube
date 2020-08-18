const { parser } = require('@hkube/parsers');
const Logger = require('@hkube/logger');
const { stateType } = require('@hkube/consts');
const stateAdapter = require('../../states/stateAdapter');
const Statistics = require('../core/statistics');
const producer = require('../../producer/producer');
const discovery = require('../services/service-discovery');
const PendingScale = require('../core/pending-scale');
const { calcRates } = require('../core/metrics');
const { Components } = require('../../consts');
const component = Components.MASTER_SCALER;
let log;

class MasterAdapter {
    constructor(options) {
        log = Logger.GetLogFromContainer();
        this.isMaster = true;
        this.nodeName = options.nodeName;
        this._options = options;
        this._isStateful = options.node.stateType === stateType.Stateful;
        const { jobId, nodeName } = options;
        stateAdapter.watchStreamingStats({ jobId, nodeName });
        stateAdapter.on(`streaming-statistics-${options.nodeName}`, (data) => {
            this.report(data);
        });
        this.clean();
    }

    clean() {
        this._progress = 0;
        this._statistics = new Statistics(this._options.config);
        this._pendingScale = new PendingScale(this._options.config);
    }

    finish() {
        const { jobId, nodeName } = this._options;
        const key = `${jobId}/${nodeName}`;
        stateAdapter.releaseLock(key);
        stateAdapter.unWatchStreamingStats({ jobId, nodeName });
    }

    report(data) {
        this._statistics.report(data);
    }

    getProgress() {
        return this._progress;
    }

    scale() {
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
            const { reqRate, resRate, durationsRate } = calcRates(stats, this._options.config);

            this._updateProgress(reqRate, resRate);

            if (this._isStateful) {
                return;
            }
            if (!reqRate && !resRate && !durationsRate) {
                return;
            }
            this._updateScale(nodeName, reqRate, resRate, durationsRate, currentSize, scaleUp, scaleDown);
        });
        return { scaleUp, scaleDown };
    }

    _updateProgress(reqRate, resRate) {
        if (reqRate && resRate) {
            const progress = parseFloat((resRate / reqRate).toFixed(2));
            this._progress = progress;
        }
    }

    _updateScale(nodeName, reqRate, resRates, durationsRates, currentSize, scaleUp, scaleDown) {
        let resRate = resRates;
        let durationsRate = durationsRates;
        let hasResRate = true;

        this._printRatesStats(nodeName, reqRate, resRate, durationsRates);

        if (!resRate) {
            resRate = reqRate;
            hasResRate = false;
        }
        if (!durationsRate) {
            durationsRate = reqRate;
        }
        const reqResRatio = reqRate / resRate;
        const durationsRatio = reqRate / durationsRate;

        this._pendingScale.check(currentSize);

        if (this._shouldScaleUp(reqResRatio, this._options.config, this._pendingScale, hasResRate)) {
            const scaleSize = this._calcSize(currentSize, reqResRatio);
            const replicas = Math.min(scaleSize, this._options.config.maxReplicas);
            const scaleTo = currentSize + replicas;
            this._logScaling('up', nodeName, currentSize, scaleTo, reqResRatio);
            scaleUp.push({ nodeName, replicas });
            this._pendingScale.updateUp(scaleTo);
        }
        else if (this._shouldScaleDown(durationsRatio, this._options.config, currentSize, this._pendingScale)) {
            const scaleSize = this._calcSize(currentSize, durationsRatio);
            const replicas = Math.min(scaleSize, currentSize);
            const scaleTo = currentSize - replicas;
            this._logScaling('down', nodeName, currentSize, scaleTo, durationsRatio);
            scaleDown.push({ nodeName, replicas });
            this._pendingScale.updateDown(scaleTo);
        }
    }

    _printRatesStats(nodeName, req, res, durations) {
        if (!this._lastPrint || Date.now() - this._lastPrint >= 30000) {
            log.info(`rates stats: nodeName=${nodeName}, req=${req.toFixed(2)}, res=${res.toFixed(2)}, durations=${durations.toFixed(2)}`, { component });
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
            const { replicas } = j;
            const tasks = [];
            const parse = {
                flowInputMetadata: this._options.pipeline.flowInputMetadata,
                nodeInput: this._options.node.input,
                ignoreParentResult: true
            };
            const result = parser.parse(parse);
            for (let i = 0; i < replicas; i += 1) {
                const taskId = producer.createTaskID();
                const task = { taskId, input: result.input, storage: result.storage, batchIndex: i + 1 };
                tasks.push(task);
            }
            const job = {
                ...this._options.jobData,
                ...this._options.node,
                tasks,
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

module.exports = MasterAdapter;
