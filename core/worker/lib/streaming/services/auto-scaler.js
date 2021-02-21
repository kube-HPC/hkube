const { parser } = require('@hkube/parsers');
const Logger = require('@hkube/logger');
const { sum, mean } = require('@hkube/stats');
const { stateType } = require('@hkube/consts');
const stateAdapter = require('../../states/stateAdapter');
const { Statistics, Scaler, ScaleReasons, Metrics, TimeMarker } = require('../core');
const { calcRates, calcRatio, formatNumber, scaleQueueSize } = Metrics;
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
        this._algorithmName = options.node.algorithmName;
        this._options = options;
        this._config = options.config;
        this._isStateful = options.node.stateType === stateType.Stateful;
        this._onSourceRemove = onSourceRemove;
        this.reset();
    }

    reset() {
        this._metrics = [];
        this._queueSizeTime = new TimeMarker(this._config.queue.minTimeEmptyToScaleDown);
        this._timeForDown = new TimeMarker(this._config.scaleDown.maxTimeIdleBeforeReplicaDown);
        this._statistics = new Statistics(this._config, this._onSourceRemove);
        if (!this._isStateful) {
            this._scaler?.stop();
            this._scaler = new Scaler(this._config, {
                getCurrentSize: () => {
                    return discovery.countInstances(this._nodeName);
                },
                getQueue: async () => {
                    const queue = await stateAdapter.getQueue(this._algorithmName);
                    return queue;
                },
                getUnScheduledAlgorithm: async () => {
                    const unScheduledAlgorithms = await stateAdapter.getUnScheduledAlgorithms();
                    return unScheduledAlgorithms[this._algorithmName];
                },
                scaleUp: (scale) => {
                    this._scaleUp(scale);
                },
                scaleDown: (scale) => {
                    this._scaleDown(scale);
                }
            });
        }
    }

    finish() {
        this._scaler?.stop();
    }

    report(data) {
        this._statistics.report(data);
    }

    getMetrics() {
        return this._metrics;
    }

    scale() {
        this._createScale();
    }

    _createScale() {
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
            const rates = calcRates(data);
            if (!stats[source]) {
                stats[source] = { windowSize, rates: [] };
            }
            stats[source].rates.push(rates);
        });

        const totals = {
            reqRate: 0,
            resRate: 0,
            queueSize: 0,
            durationsRate: [],
            totalRequests: 0,
            totalResponses: 0
        };

        let hasMaxSizeWindow = true;

        Object.entries(stats).forEach(([k, v]) => {
            const source = k;
            const { rates, windowSize } = v;
            const count = rates.length;
            const reqRate = formatNumber(mean(rates.map(r => r.reqRate)) * count);
            const resRate = formatNumber(mean(rates.map(r => r.resRate)) * count);
            const durationsRate = formatNumber(mean(rates.map(r => r.durationsRate)));
            const grossDurationsRate = formatNumber(mean(rates.map(r => r.grossDurationsRate)));
            const totalRequests = sum(rates.map(r => r.totalRequests));
            const totalResponses = sum(rates.map(r => r.totalResponses));
            const totalDropped = sum(rates.map(r => r.dropped));
            const throughput = formatNumber(mean(rates.map(r => r.throughput)));
            const queueSize = Math.round(sum(rates.map(r => r.queueSize)));
            const avgQueueSize = Math.round(mean(rates.map(r => r.queueSize)));
            const { required, desired, status } = this._scaler || {};
            const metric = {
                source,
                target,
                currentSize,
                required,
                desired,
                status,
                queueSize,
                avgQueueSize,
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
            totals.totalRequests += totalRequests;
            totals.totalResponses += totalResponses;
            totals.durationsRate.push(durationsRate);

            if (windowSize < this._config.statistics.maxSizeWindow / 2) {
                hasMaxSizeWindow = false;
            }
        });

        // in case new scaler is up with not enough statistics, we will continue to accumulate
        const newScaleStats = currentSize > 0 && !hasMaxSizeWindow;

        if (!this._isStateful && !newScaleStats) {
            const durationsRate = formatNumber(mean(totals.durationsRate));
            this._getScaleDetails({ ...totals, durationsRate, currentSize });
        }
        this._metrics = metrics;
    }

    _logScaling({ action, replicas, currentSize, scaleTo }) {
        log.info(`scaling ${action} ${replicas} replicas for node ${this._nodeName} from ${currentSize} to ${scaleTo} replicas`, { component });
    }

    _getScaleDetails({ reqRate, resRate, totalRequests, totalResponses, durationsRate, queueSize, currentSize }) {
        const result = { up: 0, down: 0 };
        const requiredByDurationRate = calcRatio(reqRate, durationsRate);
        const idleScaleDown = this._shouldIdleScaleDown({ reqRate, resRate });
        const resultQueueSizeTime = this._markQueueSize(queueSize);
        const canScaleDown = resultQueueSizeTime?.result;

        const msgPerSec = Math.ceil(durationsRate * currentSize);
        const replicas = (queueSize - msgPerSec);
        const requiredByQueueSize = Math.ceil(replicas / durationsRate);
        const scaledQueueSize = Math.ceil(scaleQueueSize(requiredByQueueSize));
        const requiredByDuration = requiredByDurationRate + scaledQueueSize;

        let required = null;
        let reason = null;

        // first scale up
        if (totalRequests > 0 && totalResponses === 0 && currentSize === 0) {
            required = this._config.scaleUp.replicasOnFirstScale;
            reason = ScaleReasonsMessages.REQ_ONLY({ reqRate: reqRate.toFixed(2) });
        }
        // scale up based on durations
        else if (totalRequests > 0 && currentSize < requiredByDuration) {
            required = requiredByDuration;
            reason = ScaleReasonsMessages.REQ_RES({ ratio: required });
        }

        // scale down based on stop streaming
        else if (idleScaleDown.scale && currentSize > 0 && canScaleDown) {
            required = 0;
            reason = ScaleReasonsMessages.IDLE_TIME({ time: idleScaleDown.time });
        }
        // scale down based on rate
        else if (!idleScaleDown.scale && currentSize > requiredByDuration && canScaleDown) {
            required = requiredByDuration;
            reason = ScaleReasonsMessages.DUR_RATIO({ ratio: requiredByDuration, time: resultQueueSizeTime.time });
        }

        if (required !== null) {
            this._scaler.updateRequired(required, reason);
        }
        return result;
    }

    _markQueueSize(queueSize) {
        let resultQueueSizeTime;
        if (queueSize <= this._config.queue.minQueueSizeBeforeScaleDown) {
            resultQueueSizeTime = this._queueSizeTime.mark();
        }
        else {
            this._queueSizeTime.unMark();
        }
        return resultQueueSizeTime;
    }

    _shouldIdleScaleDown({ reqRate, resRate }) {
        let time;
        let scale = false;
        if (!reqRate && !resRate) {
            const response = this._timeForDown.mark();
            if (response.result) {
                scale = true;
                time = response.time;
                this._timeForDown.unMark();
            }
        }
        return { scale, time };
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
