const { parser } = require('@hkube/parsers');
const Logger = require('@hkube/logger');
const { median, sum } = require('@hkube/stats');
const { stateType } = require('@hkube/consts');
const stateAdapter = require('../../states/stateAdapter');
const { Statistics, PendingScale, ScaleReasons, Metrics, TimeMarker, FixedWindow } = require('../core');
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
 * The AutoScaler always calculates the desired replicas by
 * dividing the reqRate with the durationsRate.
 *
 * Example:
 * required = (reqRate 300 / durationsRate 100) = 3
 * There are 300 requests per sec and the processing rate is 100 per sec.
 * So we need to scale up to 3 replicas.
 * If there are less replicas we scale-up, else scale-down.
 *
 * --Scale-Up--
 * another condition to scale up is when there were only requests and no
 * responses and there are no replicas so we scale-up 1 replica (first scale)
 * Scaling up is done by sending jobs to the Algorithm-Queue
 * and then do not scale-up until desired replicas are fulfilled.
 *
 * --Scale-Down--
 * another condition to scale down is when there are no requests and no
 * responses for x time, it will scale-down the current size to zero.
 * Scaling down is done by sending commands to the workers.
 *
 */
class AutoScaler {
    constructor(options, onSourceRemove) {
        log = Logger.GetLogFromContainer();
        this._nodeName = options.nodeName;
        this._options = options;
        this._config = options.config;
        this._isStateful = options.node.stateType === stateType.Stateful;
        this._onSourceRemove = onSourceRemove;
        this.reset();
    }

    reset() {
        this._metrics = [];
        this._queueSize = new FixedWindow(this._config.queue.minSamples);
        this._lastQueueSize = 0;
        this._scaleBasedOnQueueSize = false;
        this._timeForDown = new TimeMarker(this._config.scaleDown.maxTimeIdleBeforeReplicaDown);
        this._timeForQueue = new TimeMarker(this._config.queue.minTimeQueueSizeNonEmpty);
        this._timeForQueueEmpty = new TimeMarker(this._config.queue.minTimeQueueSizeEmpty);
        this._statistics = new Statistics(this._config, this._onSourceRemove);
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
        let scaleUp = null;
        let scaleDown = null;
        let currentSize = 0;
        const metrics = [];
        const target = this._nodeName;
        const stats = Object.create(null);
        const statistics = this._statistics.get();

        statistics.forEach((stat) => {
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
                rates.throughput = this._formatNumber((rates.resRate / rates.reqRate) * 100);
            }
            stats[source].rates.push(rates);
        });

        const totals = {
            reqRate: 0,
            resRate: 0,
            queueSize: 0,
            durationsRate: []
        };

        let hasMaxSizeWindow = true;

        Object.entries(stats).forEach(([k, v]) => {
            const source = k;
            const { rates, windowSize } = v;
            const count = rates.length;
            const reqRate = this._formatNumber(median(rates.map(r => r.reqRate)) * count);
            const resRate = this._formatNumber(median(rates.map(r => r.resRate)) * count);
            const durationsRate = this._formatNumber(median(rates.map(r => r.durationsRate)));
            const grossDurationsRate = this._formatNumber(median(rates.map(r => r.grossDurationsRate)));
            const totalRequests = sum(rates.map(r => r.totalRequests));
            const totalResponses = sum(rates.map(r => r.totalResponses));
            const totalDropped = sum(rates.map(r => r.dropped));
            const throughput = this._formatNumber(median(rates.map(r => r.throughput)));
            const queueSize = sum(rates.map(r => r.queueSize));
            const { required } = this._pendingScale;
            const metric = {
                source,
                target,
                calc: this._currentCalc,
                currentSize,
                required,
                requiredByRate: this._requiredByRate,
                requiredByDuration: this._requiredByDuration,
                queueSize,
                avgQueueSize: this._avgQueueSize,
                reqRate,
                resRate,
                durationsRate,
                grossDurationsRate,
                totalRequests,
                totalResponses,
                totalDropped,
                throughput
            };
            metrics.push(metric);
            totals.reqRate += reqRate;
            totals.resRate += resRate;
            totals.queueSize += queueSize;
            totals.durationsRate.push(durationsRate);

            if (windowSize < this._config.statistics.maxSizeWindow) {
                hasMaxSizeWindow = false;
            }
        });

        this._queueSize.add(totals.queueSize);
        this._pendingScale.check(currentSize);

        // in case new scaler is up with not enough statistics, we will continue to accumulate
        const newScaleStats = currentSize > 0 && !hasMaxSizeWindow;

        if (!this._isStateful && !newScaleStats) {
            const durationsRate = this._formatNumber(median(totals.durationsRate));
            const result = this._getScaleDetails({ reqRate: totals.reqRate, resRate: totals.resRate, queueSize: totals.queueSize, durationsRate, currentSize });
            if (result.up) {
                const replicas = result.up;
                const scale = this._createScaleUp({ replicas, currentSize });
                if (scale.shouldScale) {
                    scaleUp = {
                        replicas,
                        currentSize,
                        scaleTo: scale.scaleTo,
                        reason: result.reason
                    };
                }
            }
            else if (result.down) {
                const replicas = result.down;
                const scale = this._createScaleDown({ replicas, currentSize });
                if (scale.shouldScale) {
                    scaleDown = {
                        replicas,
                        currentSize,
                        scaleTo: scale.scaleTo,
                        reason: result.reason
                    };
                }
            }
        }
        this._metrics = metrics;
        return { scaleUp, scaleDown };
    }

    _formatNumber(num) {
        return parseFloat(num.toFixed(2));
    }

    _createScaleUp({ replicas, currentSize, calc }) {
        let scaleUp = { shouldScale: false };
        const scaleTo = currentSize + replicas;

        if (this._pendingScale.canScaleUp(scaleTo)) {
            scaleUp = { shouldScale: true, scaleTo };
            this._pendingScale.updateRequiredUp(scaleTo, calc);
        }
        return scaleUp;
    }

    _createScaleDown({ replicas, currentSize }) {
        let scaleDown = { shouldScale: false };
        const scaleTo = currentSize - replicas;

        if (this._pendingScale.canScaleDown(scaleTo)) {
            scaleDown = { shouldScale: true, scaleTo };
            this._pendingScale.updateRequiredDown(scaleTo);
        }
        return scaleDown;
    }

    _logScaling({ action, replicas, currentSize, scaleTo, reason }) {
        log.info(`scaling ${action} ${replicas} replicas for node ${this._nodeName} from ${currentSize} to ${scaleTo} replicas ${reason.message}`, { component });
    }

    _getScaleDetails({ reqRate, resRate, durationsRate, currentSize }) {
        const result = { up: 0, down: 0 };
        const scaleUp = this._shouldScaleUp({ reqRate, resRate });
        const requiredByRate = Metrics.calcRatio(reqRate, resRate, false);
        const requiredByDuration = Metrics.calcRatio(reqRate, durationsRate);

        if (scaleUp.scale && currentSize === 0) {
            result.up = this._config.scaleUp.replicasOnFirstScale;
            result.reason = scaleUp.reason;
        }
        else {
            const isSampleFull = this._queueSize.size === this._queueSize.maxSize;
            if (isSampleFull) {
                this._avgQueueSize = Math.ceil(sum(this._queueSize.items) / this._queueSize.size);
                const msgPerSec = Math.ceil(durationsRate * currentSize);
                const replicas = (this._avgQueueSize - msgPerSec);
                const required = Math.ceil(replicas / durationsRate);
                const maxScale = this._config.scaleUp.maxScaleUpReplicas;
                if (required > 0) {
                    result.up = maxScale;
                    result.reason = ScaleReasonsMessages.REQ_RES({ ratio: result.up });
                }
                else if (required < 0) {
                    const canScaleDown = currentSize - maxScale >= 1;
                    if (canScaleDown) {
                        result.down = maxScale;
                        result.reason = ScaleReasonsMessages.REQ_RES({ ratio: result.down });
                    }
                }
                this._currentCalc = `(${durationsRate} * ${currentSize}) = ${msgPerSec} --> (${this._avgQueueSize} - ${msgPerSec}) = ${replicas} --> (${replicas} / ${durationsRate}) = ${required}`;
            }
            if (requiredByRate > 0 && currentSize > 0) {
                const required = Math.round(requiredByRate * currentSize);
                if (required > 0) {
                    this._requiredByRate = required;
                }
                this._requiredByDuration = requiredByDuration;
            }
        }
        // const required = Metrics.calcRatio(reqRate, durationsRate);
        // const scaleDown = this._shouldScaleDown({ reqRate, resRate });
        // const scaleUpBasedOnQueue = this._scaleUpBasedOnQueue({ queueSize });

        // need to scale up
        // if (scaleUp.scale) {
        //     result.up = currentSize > 0 ? 0 : this._config.scaleUp.replicasOnFirstScale;
        //     result.reason = scaleUp.reason;
        // }
        // else if (currentSize < required && reqRate > 0) {
        //     const ratio = required - currentSize;
        //     result.up = Math.min(ratio, this._config.scaleUp.maxScaleUpReplicas);
        //     result.reason = ScaleReasonsMessages.REQ_RES({ ratio });
        // }
        // else if (scaleUpBasedOnQueue.scale) {
        //     this._scaleBasedOnQueueSize = true;
        //     const { percentReplicasQueueSizeNonEmpty } = this._config.queue;
        //     result.up = Math.ceil(currentSize * percentReplicasQueueSizeNonEmpty) || 1;
        //     result.reason = scaleUpBasedOnQueue.reason;
        // }

        // need to scale down
        // else if (scaleDown.scale && currentSize > 0 && queueSize === 0) {
        //     result.down = currentSize;
        //     result.reason = scaleDown.reason;
        //     this._lastQueueSize = queueSize;
        // }
        // else if (currentSize > required && required > 0 && queueSize === 0 && !this._scaleBasedOnQueueSize) {
        //     const timeMark = this._timeForQueueEmpty.mark();
        //     if (timeMark.result) {
        //         this._lastQueueSize = queueSize;
        //         result.down = currentSize - required;
        //         result.reason = ScaleReasonsMessages.DUR_RATIO({ ratio: required, time: timeMark.time });
        //         this._timeForQueueEmpty.unMark();
        //     }
        // }
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

    _shouldScaleDown({ reqRate, resRate }) {
        let reason;
        let scale = false;
        if (!reqRate && !resRate) {
            const { result, time } = this._timeForDown.mark();
            if (result) {
                scale = true;
                reason = ScaleReasonsMessages.IDLE_TIME({ time });
                this._timeForDown.unMark();
            }
        }
        return { scale, reason };
    }

    _scaleUpBasedOnQueue({ queueSize }) {
        let reason;
        let scale = false;
        const { minQueueSizeForScaleUp } = this._config.queue;

        if (queueSize >= minQueueSizeForScaleUp && queueSize > this._lastQueueSize) {
            const { result, time } = this._timeForQueue.mark();
            if (result) {
                scale = true;
                this._lastQueueSize = queueSize;
                reason = ScaleReasonsMessages.QUEUE_SIZE({ queueSize, time });
                this._timeForQueue.unMark();
            }
        }
        else if (queueSize <= this._lastQueueSize) {
            this._lastQueueSize = queueSize;
        }
        return { scale, reason };
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
