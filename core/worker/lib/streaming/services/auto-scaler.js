const { parser } = require('@hkube/parsers');
const Logger = require('@hkube/logger');
const { stateType } = require('@hkube/consts');
const stateAdapter = require('../../states/stateAdapter');
const { Statistics, Progress, PendingScale, Metrics } = require('../core');
const producer = require('../../producer/producer');
const discovery = require('./service-discovery');
const { Components } = require('../../consts');
const component = Components.AUTO_SCALER;
let log;

class AutoScaler {
    constructor(options) {
        log = Logger.GetLogFromContainer();
        this._nodeName = options.nodeName;
        this._options = options;
        this._isStateful = options.node.stateType === stateType.Stateful;
        this.clean();
    }

    clean() {
        this._metrics = [];
        this._progress = new Progress();
        this._statistics = new Statistics(this._options.config);
        this._pendingScale = new PendingScale(this._options.config);
    }

    report(data) {
        this._statistics.report(data);
    }

    getProgress() {
        return this._progress.data;
    }

    getMetrics() {
        return this._metrics;
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
        this._metrics = [];

        for (const stat of this._statistics) {
            const { source, data } = stat;
            const { nodeName } = data;
            const currentSize = data.currentSize || discovery.countInstances(nodeName);
            const { reqRate, resRate, durationsRate, totalRequests, totalResponses } = Metrics.CalcRates(stat.data, this._options.config);

            this._metrics.push({ source, target: nodeName, reqRate, resRate, durationsRate, totalRequests, totalResponses });

            const noRates = !reqRate && !resRate && !durationsRate;

            if (!this._isStateful && !noRates) {
                const result = this._updateScale(nodeName, reqRate, resRate, durationsRate, currentSize);
                if (result.up) {
                    scaleUp.push({ source, replicas: result.up });
                }
                else if (result.down) {
                    scaleDown.push({ source, replicas: result.down });
                }
            }
        }
        this._printRatesStats(this._metrics);
        this._updateProgress(this._metrics);

        return { scaleUp, scaleDown };
    }

    _printRatesStats(metrics) {
        if (!this._lastPrint || Date.now() - this._lastPrint >= 30000) {
            metrics.forEach(s => {
                log.info(`stats for ${s.source}=>${s.target}: req rate=${s.reqRate.toFixed(2)}, res rate=${s.resRate.toFixed(2)}, durations rate=${s.durationsRate.toFixed(2)}, total requests=${s.totalRequests}, total responses=${s.totalResponses}`, { component });
            });
            this._lastPrint = Date.now();
        }
    }

    _updateProgress(metrics) {
        metrics.forEach(s => {
            if (s.reqRate && s.resRate) {
                const progress = parseFloat((s.resRate / s.reqRate).toFixed(2));
                this._progress.update(s.source, progress);
            }
        });
    }

    _updateScale(nodeName, reqRate, resRates, durationsRates, currentSize) {
        let resRate = resRates;
        let durationsRate = durationsRates;
        let hasResRate = true;

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
        const result = { up: 0, down: 0 };

        if (this._shouldScaleUp(reqResRatio, this._options.config, this._pendingScale, hasResRate)) {
            const scaleSize = this._calcSize(currentSize, reqResRatio);
            const replicas = Math.min(scaleSize, this._options.config.maxReplicas);
            const scaleTo = currentSize + replicas;
            this._logScaling('up', nodeName, currentSize, scaleTo, reqResRatio);
            result.up = replicas;
            this._pendingScale.updateUp(scaleTo);
        }
        else if (this._shouldScaleDown(durationsRatio, this._options.config, currentSize, this._pendingScale)) {
            const scaleSize = this._calcSize(currentSize, durationsRatio);
            const replicas = Math.min(scaleSize, currentSize);
            const scaleTo = currentSize - replicas;
            this._logScaling('down', nodeName, currentSize, scaleTo, durationsRatio);
            result.down = replicas;
            this._pendingScale.updateDown(scaleTo);
        }
        return result;
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
            && durationsRatio <= metric.minRatioToScaleDown;
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

module.exports = AutoScaler;
