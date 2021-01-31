const { parser } = require('@hkube/parsers');
const Logger = require('@hkube/logger');
const { stateType } = require('@hkube/consts');
const stateAdapter = require('../../states/stateAdapter');
const { Statistics, PendingScale, Throughput, ScaleReasons, Metrics, IdleMarker } = require('../core');
const { ScaleReasonsCodes, ScaleReasonsMessages } = ScaleReasons;
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
        this._throughput = new Throughput();
        this._idles = new IdleMarker(this._config);
        this._statsPrint = Object.create(null);
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
            const windowSize = data.requests.size;
            const { reqRate, resRate, durationsRate, totalRequests, totalResponses } = Metrics.calcRates(data);

            const metric = { source, target, currentSize, reqRate, resRate, durationsRate, totalRequests, totalResponses };
            this._metrics.push(metric);
            sources.push(source);
            this._updateThroughput(metric);
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
        }
        const { scaleUp, scaleDown } = this._resolveConflicts(upList, downList, sources, currentSize);
        return { scaleUp, scaleDown };
    }

    _resolveConflicts(upList, downList, sources, currentSize) {
        let scaleUp = null;
        let scaleDown = null;
        this._pendingScale.check(currentSize);

        if (upList.length > 0 && downList.length > 0) {
            log.throttle.warning(`scaling collision detected, node ${upList[0].source} scale up ${upList[0].count}, and node ${downList[0].source} scale down ${downList[0].count}, scaling up...`, { component });
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
            const throughput = parseFloat(((resRate / reqRate) * 100).toFixed(2));
            this._throughput.update(source, throughput);
        }
        else {
            this._throughput.update(source, 0);
        }
    }

    _getScaleDetails({ source, reqRate, resRate, durationsRate, currentSize }) {
        const result = { up: 0, down: 0 };
        const reqResRatio = Metrics.calcRatio(reqRate, resRate);
        const durationsRatio = Metrics.calcRatio(reqRate, durationsRate);
        const scaleUp = this._shouldScaleUp({ reqResRatio, reqRate, resRate });
        const scaleDown = this._shouldScaleDown({ source, durationsRatio, reqRate, resRate });

        if (scaleUp.scale) {
            let scaleSize;
            if (scaleUp.reason.code === ScaleReasonsCodes.REQ_ONLY && currentSize > 0) {
                scaleSize = 0;
            }
            else {
                scaleSize = this._calcSize(currentSize, Math.abs(1 - reqResRatio));
            }
            const replicas = Math.min(scaleSize, this._config.maxScaleUpReplicas);
            result.up = replicas;
            result.reason = scaleUp.reason;
        }
        else if (scaleDown.scale) {
            let scaleSize;
            if (scaleDown.reason.code === ScaleReasonsCodes.DUR_RATIO) {
                scaleSize = this._calcSize(currentSize, durationsRatio);
                scaleSize = scaleSize >= currentSize ? currentSize - 1 : scaleSize;
            }
            else if (scaleDown.reason.code === ScaleReasonsCodes.IDLE_TIME) {
                scaleSize = currentSize;
            }
            const replicas = Math.min(scaleSize, currentSize);
            result.down = replicas;
            result.reason = scaleDown.reason;
        }
        return result;
    }

    _calcSize(currentSize, currentRatio) {
        const size = currentSize || 1;
        const ratio = currentRatio || 1;
        return Math.ceil(size * ratio);
    }

    _shouldScaleUp({ reqResRatio, reqRate, resRate }) {
        let reason;
        let scale = false;
        if (reqResRatio >= this._config.minRatioToScaleUp) {
            scale = true;
            reason = ScaleReasonsMessages.REQ_RES({ reqResRatio: reqResRatio.toFixed(2), minRatioToScaleUp: this._config.minRatioToScaleUp });
        }
        else if (!resRate && reqRate > 0) {
            scale = true;
            reason = ScaleReasonsMessages.REQ_ONLY({ reqRate: reqRate.toFixed(2) });
        }
        return { scale, reason };
    }

    _shouldScaleDown({ source, durationsRatio, reqRate, resRate }) {
        let result = this._idles.checkIdleReason({ reqRate, resRate, source });
        if (!result.scale) {
            result = this._idles.checkDurationsReason({ durationsRatio, source });
        }
        return result;
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
