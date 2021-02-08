const { parser } = require('@hkube/parsers');
const Logger = require('@hkube/logger');
const { median, sum } = require('@hkube/stats');
const { stateType } = require('@hkube/consts');
const stateAdapter = require('../../states/stateAdapter');
const { Statistics, PendingScale, ScaleReasons, Metrics, IdleMarker } = require('../core');
const { ScaleReasonsMessages } = ScaleReasons;
const producer = require('../../producer/producer');
const discovery = require('./service-discovery');
const { Components } = require('../../consts');
const component = Components.AUTO_SCALER;
let log;

/**
 * The AutoScaler used by the master adapter
 * in order to scale up/down stateless algorithms.
 * Each tick, it looks at statistics data and then
 * calculating ratios and rates (see: metrics.calcRates).
 *
 * The ratios are:
 *  - reqResRatio: reqRate / resRate
 *  - durationsRatio: reqRate / durationsRate
 *
 * --Scale-Up--
 * There are two conditions for scale-up:
 * 1. reqResRatio >= minRatioToScaleUp --> (default: 1.2)
 * 2. !resRate && reqRate > 0
 *
 * Example:
 * 1. reqResRatio = (reqRate 300 / resRate 120) = 2.5
 *    The response rate is 2.5 times slower than request rate.
 *    In this case, the first condition is kicked in.
 *    so, it will scale-up current replicas * Math.abs(1 - 2.5).
 * 2. If there were only requests and no responses,
 *    it will scale-up current replicas * 1.
 *    Scaling up is done by sending jobs to the Algorithm-Queue
 *    and then do not scale-up until desired replicas are fulfilled.
 *
 * --Scale-Down--
 * There are two conditions for scale-down:
 * 1. !reqRate && !resRate
 * 2. durationsRatio <= minRatioToScaleDown --> (default: 0.8)
 *
 * Example:
 * 1. If there are no requests and no responses for x time,
 *    it will scale-down the current size to zero.
 * 2. If the durationsRatio is 0.5 for x time,
 *    it will scale-down current replicas * 0.5.
 *
 * The desired ratio to not scale at all is ~1 (0.8 <= desired <= 1.2)
 * Scaling down is done by sending commands to the workers.
 *
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
        this._idles = new IdleMarker(this._config);
        this._statsPrint = Object.create(null);
        this._statistics = new Statistics(this._config);
        this._pendingScale = new PendingScale(this._config);
    }

    report(data) {
        this._statistics.report(data);
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
        const metrics = [];
        let currentSize = 0;
        const target = this._nodeName;
        const sources = [];
        const stats = Object.create(null);

        for (const stat of this._statistics) {
            const { data } = stat;
            const windowSize = data.requests.size;
            currentSize = data.currentSize || discovery.countInstances(target);
            const [source] = stat.source.split(`-${this._options.jobId}-`);
            const rates = Metrics.calcRates(data);
            if (!stats[source]) {
                stats[source] = { windowSize, rates: [] };
            }
            rates.throughput = 0;
            if (rates.reqRate && rates.resRate) {
                rates.throughput = parseFloat(((rates.resRate / rates.reqRate) * 100).toFixed(2));
            }
            stats[source].rates.push(rates);
        }

        Object.entries(stats).forEach(([k, v]) => {
            const source = k;
            const { rates, windowSize } = v;
            const reqRate = this._formatNumber(median(rates.map(r => r.reqRate)));
            const resRate = this._formatNumber(median(rates.map(r => r.resRate)));
            const durationsRate = this._formatNumber(median(rates.map(r => r.durationsRate)));
            const totalRequests = sum(rates.map(r => r.totalRequests));
            const totalResponses = sum(rates.map(r => r.totalResponses));
            const totalDropped = sum(rates.map(r => r.dropped));
            const throughput = this._formatNumber(median(rates.map(r => r.throughput)));
            const { required } = this._pendingScale;
            const metric = { source, target, currentSize, required, reqRate, resRate, durationsRate, totalRequests, totalResponses, totalDropped, throughput };
            metrics.push(metric);
            sources.push(source);
            this._printRatesStats(metric);

            // in case new scaler is up with not enough statistics, we will continue to accumulate
            const newScaleStats = currentSize > 0 && windowSize < this._config.maxSizeWindow;

            if (!this._isStateful && !newScaleStats) {
                const result = this._getScaleDetails({ source, reqRate, resRate, durationsRate, currentSize });
                if (result.up) {
                    upList.push({ source, count: result.up, reason: result.reason });
                }
                else if (result.down) {
                    downList.push({ source, count: result.down, reason: result.reason });
                }
            }
        });
        this._metrics = metrics;
        const { scaleUp, scaleDown } = this._resolveConflicts({ upList, downList, sources, currentSize });
        return { scaleUp, scaleDown };
    }

    _formatNumber(num) {
        return parseFloat(num.toFixed(2));
    }

    _resolveConflicts({ upList, downList, sources, currentSize }) {
        let scaleUp = null;
        let scaleDown = null;
        this._pendingScale.check(currentSize);

        if (upList.length > 0 && downList.length > 0) {
            log.throttle.warning(`scaling collision detected, node ${upList[0].source} scale up ${upList[0].count}, and node ${downList[0].source} scale down ${downList[0].count}, scaling up...`, { component });
            scaleUp = this._createScaleUp({ upList, currentSize });
        }
        else if (upList.length > 0) {
            scaleUp = this._createScaleUp({ upList, currentSize });
        }
        else if (downList.length > 0) {
            scaleDown = this._createScaleDown({ downList, sources, currentSize });
        }
        return { scaleUp, scaleDown };
    }

    _createScaleUp({ upList, currentSize }) {
        let scaleUp = null;
        const replicas = Math.round(median(upList.map(l => l.count)));
        const scaleTo = currentSize + replicas;

        if (this._pendingScale.canScaleUp(scaleTo)) {
            scaleUp = { replicas, scaleTo, currentSize };
            this._pendingScale.updateRequiredUp(scaleTo);
        }
        return scaleUp;
    }

    _createScaleDown({ downList, sources, currentSize }) {
        let scaleDown = null;
        const replicas = Math.round(median(downList.map(l => l.count)));
        const scaleTo = currentSize - replicas;

        if (scaleTo === 0 && downList.length !== sources.length) {
            return scaleDown;
        }

        if (this._pendingScale.canScaleDown(scaleTo)) {
            scaleDown = { replicas, scaleTo, currentSize };
            this._pendingScale.updateRequiredDown(scaleTo);
        }
        return scaleDown;
    }

    _printRatesStats(metric) {
        const { source } = metric;
        if (!this._statsPrint[source] || Date.now() - this._statsPrint[source] >= this._config.logStatsInterval) {
            const { target, currentSize, reqRate, resRate, durationsRate, totalRequests, totalResponses } = metric;
            const req = this._pendingScale.required;
            const per = currentSize && req ? (currentSize / req) * 100 : 0;
            const scale = `scale=${per.toFixed(0)}% (${currentSize}/${req})`;
            const rates = `req=${reqRate.toFixed(0)}, res=${resRate.toFixed(0)}, dur=${durationsRate.toFixed(0)}`;
            const total = `total req=${totalRequests}, total res=${totalResponses}`;
            log.info(`stats for ${source}=>${target}: ${scale}, ${rates}, ${total}`, { component });
            this._statsPrint[source] = Date.now();
        }
    }

    _logScaling({ action, currentSize, scaleTo }) {
        log.info(`scaling ${action} from ${currentSize} to ${scaleTo} replicas`, { component });
    }

    _getScaleDetails({ source, reqRate, resRate, durationsRate, currentSize }) {
        const result = { up: 0, down: 0 };
        const required = Metrics.calcRatio(reqRate, durationsRate);
        const scaleUp = this._shouldScaleUp({ reqRate, resRate });
        const scaleDown = this._shouldScaleDown({ source, reqRate, resRate });

        // need to scale up
        if (scaleUp.scale) {
            result.up = currentSize > 0 ? 0 : 1;
            result.reason = scaleUp.reason;
        }
        else if (currentSize < required && reqRate > 0) {
            const requiredByDuration = required - currentSize;
            result.up = Math.min(requiredByDuration, this._config.maxScaleUpReplicas);
            result.reason = ScaleReasonsMessages.REQ_RES({ reqResRatio: requiredByDuration });
        }

        // need to scale down
        else if (scaleDown.scale && currentSize > 0) {
            result.down = currentSize;
            result.reason = scaleDown.reason;
        }
        else if (currentSize > required && required > 0) {
            result.down = currentSize - required;
            result.reason = ScaleReasonsMessages.DUR_RATIO({ durationsRatio: required });
        }
        return result;
    }

    _shouldScaleUp({ reqRate, resRate }) {
        let reason;
        let scale = false;
        if (!resRate && reqRate > 0) {
            scale = true;
            reason = ScaleReasonsMessages.REQ_ONLY({ reqRate: reqRate.toFixed(2) });
        }
        return { scale, reason };
    }

    _shouldScaleDown({ source, reqRate, resRate }) {
        return this._idles.checkIdleReason({ reqRate, resRate, source });
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
            ...this._options.node,
            jobId: this._options.jobId,
            tasks,
            isScaled: true,
            parsedFlow: this._options.pipeline.streaming?.parsedFlow,
            defaultFlow: this._options.pipeline.streaming?.defaultFlow,
            pipelineName: this._options.pipeline.name,
            priority: this._options.pipeline.priority,
            kind: this._options.pipeline.kind,
            info: this._options.jobData.info,
        };
        return producer.createJob({ jobData: job });
    }

    _scaleDown(scale) {
        if (!scale) {
            return null;
        }
        this._logScaling({ action: 'down', ...scale });
        const { replicas, scaleTo } = scale;
        const discoveryWorkers = discovery.getInstances(this._nodeName);
        // we will prefer not to scale-down masters, unless we scaling down to zero
        const instances = scaleTo === 0 ? discoveryWorkers : discoveryWorkers.filter(d => !d.isMaster);
        const workers = instances.slice(0, replicas);
        return Promise.all(workers.map(w => stateAdapter.stopWorker({ workerId: w.workerId })));
    }
}

module.exports = AutoScaler;
