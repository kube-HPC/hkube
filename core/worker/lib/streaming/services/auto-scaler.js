const { parser } = require('@hkube/parsers');
const Logger = require('@hkube/logger');
const { stateType } = require('@hkube/consts');
const stateAdapter = require('../../states/stateAdapter');
const { Statistics, Throughput, PendingScale, Metrics } = require('../core');
const ScaleReasons = require('../core/scale-reasons');
const producer = require('../../producer/producer');
const discovery = require('./service-discovery');
const { Components } = require('../../consts');
const component = Components.AUTO_SCALER;
let log;

/**
 * The AutoScaler is the class that responsible
 * for scale up/down, this class used by the master adapter.
 */
class AutoScaler {
    constructor(options) {
        log = Logger.GetLogFromContainer();
        this._nodeName = options.nodeName;
        this._options = options;
        this._config = options.config;
        this._isStateful = options.node.stateType === stateType.Stateful;
        this.reset();
    }

    reset() {
        this._metrics = [];
        this._idles = Object.create(null);
        this._statsPrint = Object.create(null);
        this._throughput = new Throughput();
        this._statistics = new Statistics(this._config);
        this._pendingScale = new PendingScale(this._config);
    }

    report(data) {
        this._statistics.report(data);
    }

    getThroughput() {
        return this._throughput.data;
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
        const upList = [];
        const downList = [];
        this._metrics = [];
        let currentSize = 0;
        const target = this._nodeName;
        const sources = [];

        for (const stat of this._statistics) {
            const { source, data } = stat;
            currentSize = data.currentSize || discovery.countInstances(target);
            const { reqRate, resRate, durationsRate, totalRequests, totalResponses } = Metrics.CalcRates(stat.data, this._config);

            const metric = { source, target, currentSize, reqRate, resRate, durationsRate, totalRequests, totalResponses };
            this._metrics.push(metric);
            sources.push(source);
            this._updateThroughput(metric);
            this._printRatesStats(metric);

            if (!this._isStateful) {
                const result = this._getScaleDetails({ source, reqRate, resRate, durationsRate, currentSize });
                if (result.up) {
                    upList.push({ source, count: result.up, reason: result.reason });
                }
                else if (result.down) {
                    downList.push({ source, count: result.down, reason: result.reason });
                }
            }
        }
        const { scaleUp, scaleDown } = this._resolveConflicts(upList, downList, sources, currentSize);
        return { scaleUp, scaleDown };
    }

    _resolveConflicts(upList, downList, sources, currentSize) {
        let scaleUp = null;
        let scaleDown = null;
        this._pendingScale.check(currentSize);

        if (upList.length > 0 && downList.length > 0) {
            log.warning(`scaling collision detected, node ${upList[0].source} scale up ${upList[0].count}, and node ${downList[0].source} scale down ${downList[0].count}`, { component });
            scaleUp = this._createScaleUp(upList, currentSize);
        }
        else if (upList.length > 0) {
            scaleUp = this._createScaleUp(upList, currentSize, scaleUp);
        }
        else if (downList.length === sources.length) {
            scaleDown = this._createScaleDown(downList, currentSize, scaleDown);
        }
        return { scaleUp, scaleDown };
    }

    _createScaleUp(upList, currentSize) {
        let scaleUp = null;
        const up = this._findMaxIndex(upList);
        if (this._pendingScale.canScaleUp(up.count)) {
            const scaleTo = currentSize + up.count;
            scaleUp = { source: up.source, replicas: up.count, currentSize, scaleTo, reason: up.reason, nodes: upList.map(l => l.count) };
            this._pendingScale.updateRequiredUp(up.count);
        }
        return scaleUp;
    }

    _createScaleDown(downList, currentSize) {
        let scaleDown = null;
        const down = this._findMinIndex(downList);
        if (this._pendingScale.canScaleDown(down.count)) {
            const scaleTo = currentSize - down.count;
            scaleDown = { source: down.source, replicas: down.count, currentSize, scaleTo, reason: down.reason, nodes: downList.map(l => l.count) };
            this._pendingScale.updateRequiredDown(down.count);
        }
        return scaleDown;
    }

    _findMaxIndex(list) {
        let index;
        let max = 0;
        list.forEach((l, i) => {
            if (l.count > max) {
                max = l.count;
                index = i;
            }
        });
        return list[index] || { count: 0 };
    }

    _findMinIndex(list) {
        let index;
        let min = Number.MAX_SAFE_INTEGER;
        list.forEach((l, i) => {
            if (l.count < min) {
                min = l.count;
                index = i;
            }
        });
        return list[index] || { count: 0 };
    }

    _printRatesStats(metric) {
        if (!this._statsPrint[metric.source] || Date.now() - this._statsPrint[metric.source] >= this._config.logStatsInterval) {
            const { source, target, currentSize, reqRate, resRate, durationsRate, totalRequests, totalResponses } = metric;
            const req = this._pendingScale.required;
            const per = currentSize && req ? (currentSize / req) * 100 : 0;
            const scale = `scale=${per.toFixed(0)}% (${currentSize}/${req})`;
            const rates = `req=${reqRate.toFixed(0)}, res=${resRate.toFixed(0)}, dur=${durationsRate.toFixed(0)}`;
            const total = `total req=${totalRequests}, total res=${totalResponses}`;
            log.info(`stats for ${source}=>${target}: ${scale}, ${rates}, ${total}`, { component });
            this._statsPrint[metric.source] = Date.now();
        }
    }

    _logScaling({ action, source, currentSize, scaleTo, reason, nodes }) {
        const nodesScale = nodes.length > 1 ? `, nodes: [${nodes}]` : '';
        log.info(`scaling ${action} from ${currentSize} to ${scaleTo} replicas for ${source}=>${this._nodeName} ${reason.message} ${nodesScale}`, { component });
    }

    _updateThroughput(metric) {
        const { source, reqRate, resRate } = metric;
        if (reqRate && resRate) {
            const throughput = parseFloat((resRate / reqRate).toFixed(2));
            this._throughput.update(source, throughput);
        }
        else {
            this._throughput.update(source, 0);
        }
    }

    _getScaleDetails({ source, reqRate, resRate, durationsRate, currentSize }) {
        const result = { up: 0, down: 0 };
        const reqResRatio = this._calcRatio(reqRate, resRate);
        const durationsRatio = this._calcRatio(reqRate, durationsRate);
        const scaleUp = this._shouldScaleUp({ reqResRatio, reqRate, resRate });
        const scaleDown = this._shouldScaleDown({ source, durationsRatio, currentSize, reqRate, resRate });

        if (scaleUp.scale) {
            const scaleSize = this._calcSize(currentSize, reqResRatio);
            const replicas = Math.min(scaleSize, this._config.maxScaleUpReplicas);
            result.up = replicas;
            result.reason = scaleUp.reason;
        }
        else if (scaleDown.scale) {
            let scaleSize;
            if (scaleDown.reason.code === ScaleReasons.DUR_RATIO()) {
                scaleSize = this._calcSize(currentSize, durationsRatio);
                scaleSize = scaleSize >= currentSize ? currentSize - 1 : scaleSize;
            }
            else if (scaleDown.reason.code === ScaleReasons.IDLE_TIME()) {
                scaleSize = currentSize;
            }
            const replicas = Math.min(scaleSize, currentSize);
            result.down = replicas;
            result.reason = scaleDown.reason;
        }
        return result;
    }

    _calcRatio(rate1, rate2) {
        const ratio = (rate1 && rate2) ? (rate1 / rate2) : 1;
        return ratio;
    }

    _calcSize(currentSize, ratio) {
        const size = currentSize || 1;
        return Math.ceil(size * ratio);
    }

    _shouldScaleUp({ reqResRatio, reqRate, resRate }) {
        let reason;
        let scale = false;
        if (reqResRatio >= this._config.minRatioToScaleUp) {
            scale = true;
            reason = ScaleReasons.REQ_RES({ reqResRatio: reqResRatio.toFixed(2), minRatioToScaleUp: this._config.minRatioToScaleUp });
        }
        else if (!resRate && reqRate > 0) {
            scale = true;
            reason = ScaleReasons.REQ_ONLY({ reqRate: reqRate.toFixed(2) });
        }
        return { scale, reason };
    }

    _shouldScaleDown({ source, durationsRatio, reqRate, resRate }) {
        let result = this._getIdleReason(reqRate, resRate, source);
        if (!result.scale) {
            result = this._getDurationsReason(durationsRatio, source);
        }
        return result;
    }

    _getDurationsReason(durationsRatio, source) {
        let reason;
        let scale = false;
        const code = ScaleReasons.DUR_RATIO();
        if (durationsRatio <= this._config.minRatioToScaleDown) {
            const { result, time } = this._markIdleTime({ source, code });
            if (result) {
                scale = true;
                reason = ScaleReasons.DUR_RATIO({ time, durationsRatio: durationsRatio.toFixed(2) });
            }
        }
        else {
            this._unMarkIdleTime({ source, code });
        }
        return { scale, reason };
    }

    _getIdleReason(reqRate, resRate, source) {
        let reason;
        let scale = false;
        const code = ScaleReasons.IDLE_TIME();
        if (!reqRate && !resRate) {
            const { result, time } = this._markIdleTime({ source, code });
            if (result) {
                scale = true;
                reason = ScaleReasons.IDLE_TIME({ time });
            }
        }
        else {
            this._unMarkIdleTime({ source, code });
        }
        return { scale, reason };
    }

    _markIdleTime({ source, code }) {
        let result = false;
        if (!this._idles[source]) {
            this._idles[source] = {};
        }
        if (!this._idles[source][code]) {
            this._idles[source][code] = { time: Date.now() };
        }
        const diff = Date.now() - this._idles[source][code].time;
        if (diff >= this._config.maxTimeIdleBeforeReplicaDown) {
            result = true;
        }
        return { result, time: diff / 1000 };
    }

    _unMarkIdleTime({ source, code }) {
        if (this._idles[source] && this._idles[source][code]) {
            delete this._idles[source][code];
        }
    }

    _scaleUp(scale) {
        if (!scale) {
            return null;
        }
        this._logScaling({ action: 'up', ...scale });
        const { replicas } = scale;
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
        return producer.createJob({ jobData: job });
    }

    _scaleDown(scale) {
        if (!scale) {
            return null;
        }
        this._logScaling({ action: 'down', ...scale });
        const { replicas } = scale;
        const instances = discovery.getInstances(this._nodeName);
        const workers = instances.slice(0, replicas);
        return Promise.all(workers.map(w => stateAdapter.stopWorker(w.workerId)));
    }
}

module.exports = AutoScaler;
