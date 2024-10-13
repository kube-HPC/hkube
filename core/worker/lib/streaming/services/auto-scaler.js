const { parser } = require('@hkube/parsers');
const Logger = require('@hkube/logger');
const { sum, mean } = require('@hkube/stats');
const { stateType, nodeKind } = require('@hkube/consts');
const stateAdapter = require('../../states/stateAdapter');
const { Statistics, Scaler, Metrics } = require('../core');
const { calcRates, formatNumber } = Metrics;
const producer = require('../../producer/producer');
const discovery = require('./service-discovery');
const { Components } = require('../../consts');
const component = Components.AUTO_SCALER;
let log;

/**
 * The AutoScaler used by the master adapter in order
 * to scale up/down stateless algorithms.
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
 * If node is stateless, and has maxStatelessCount > 0, never scale above it
 *
 * --Scale-Down--
 * another condition to scale down is when there are no requests and no
 * responses for x time, it will scale-down the current size to zero.
 * Scaling down is done by sending commands to the workers.
 * If node is stateless, and has minStatelessCount > 0, never scale below it.
 */
class AutoScaler {
    constructor(options, onSourceRemove) {
        log = Logger.GetLogFromContainer();
        this._nodeName = options.nodeName;
        this._algorithmName = options.node.algorithmName;
        this._options = options;
        this._config = options.config;
        this._isStateful = options.node.stateType === stateType.Stateful;
        this._statelessCountLimits = { minStateless: options.node.minStatelessCount, maxStateless: options.node.maxStatelessCount };
        this._limitActionType = { minStateless: 'minStatelessCount', maxStateless: 'maxStatelessCount', both: 'bothLimits' };
        this._interventionLogCallTrack = { action: null, required: null, allowed: null, timeStamp: null };
        this._onSourceRemove = onSourceRemove;
        this.reset();
    }

    reset() {
        this._metrics = {};
        this._statistics = new Statistics(this._config, this._onSourceRemove);

        if (!this._isStateful) {
            // this._queueSizeTime = new TimeMarker(this._config.scaleDown.minTimeQueueEmptyBeforeScaleDown);
            // this._timeForDown = new TimeMarker(this._config.scaleDown.minTimeIdleBeforeReplicaDown);
            this._scaler?.stop();
            let conf = this._config;
            if (this._options.node.kind === nodeKind.Debug) {
                conf = { ...this._config, scaleUp: { ...this._config.scaleUp, maxScaleUpReplicasPerNode: 1 } };
            }
            this._scaler = new Scaler(conf, this._statelessCountLimits.minStateless, {
                getCurrentSize: () => {
                    return discovery.countInstances(this._nodeName);
                },
                getQueue: async () => {
                    const queue = await stateAdapter.getQueue(this._algorithmName);
                    return queue?.pendingAmount || queue?.data?.length;
                },
                getUnScheduledAlgorithm: async () => {
                    const algorithm = await stateAdapter.getUnScheduledAlgorithm(this._algorithmName);
                    return algorithm;
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
        const uidMetrics = [];
        const target = this._nodeName;
        const stats = Object.create(null);
        const statistics = this._statistics.get();

        statistics.forEach((stat) => {
            const { data } = stat;
            const windowSize = data.size;
            currentSize = data.currentSize || discovery.countInstances(target);
            const [source] = stat.source.split(`-${this._options.jobId}-`);
            const rates = calcRates(data);
            if (!stats[source]) {
                stats[source] = { windowSize: [], rates: [] };
            }
            uidMetrics.push({
                uid: stat.source,
                source,
                target,
                totalRequests: rates.totalRequests,
                totalResponses: rates.totalResponses,
                totalDropped: rates.dropped,
            });
            stats[source].windowSize.push(windowSize);
            stats[source].rates.push(rates);
        });

        const totals = {
            reqRate: 0,
            resRate: 0,
            queueSize: 0,
            avgQueueSize: [],
            durationsRate: [],
            windowSize: [],
            totalRequests: 0,
            totalResponses: 0,
            roundTripTimeMs: []
        };

        let hasMaxSizeWindow = true;

        Object.entries(stats).forEach(([k, v]) => {
            const source = k;
            const { rates, windowSize } = v;
            const count = rates.length;
            const reqRate = formatNumber(mean(rates.map(r => r.reqRate)) * count);
            const resRate = formatNumber(mean(rates.map(r => r.resRate)) * count);
            const durationsRate = formatNumber(mean(rates.filter(r => r.durationsRate).map(r => r.durationsRate)));
            const grossDurationsRate = formatNumber(mean(rates.map(r => r.grossDurationsRate)));
            const totalRequests = sum(rates.map(r => r.totalRequests));
            const totalResponses = sum(rates.map(r => r.totalResponses));
            const throughput = formatNumber(mean(rates.map(r => r.throughput)));
            const queueSize = sum(rates.map(r => r.queueSize));
            const avgQueueSize = Math.round(mean(rates.map(r => r.queueSize)));
            const avgWindowSize = Math.round(mean(windowSize));
            const processingTimeMs = formatNumber(mean(rates.map(r => r.processingTime)));
            const roundTripTimeMs = formatNumber(mean(rates.map(r => r.roundTripTime)));
            const queueTimeMs = formatNumber(mean(rates.map(r => r.queueTime)));
            const { required, desired, status } = this._scaler || {};
            const metric = {
                source,
                target,
                currentSize,
                required,
                desired,
                status,
                reqRate,
                resRate,
                queueSize,
                avgQueueSize,
                processingTimeMs,
                roundTripTimeMs,
                queueTimeMs,
                durationsRate,
                grossDurationsRate,
                throughput
            };
            metrics.push(metric);
            totals.reqRate += reqRate;
            totals.resRate += resRate;
            totals.queueSize += queueSize;
            totals.avgQueueSize.push(avgQueueSize);
            totals.totalRequests += totalRequests;
            totals.totalResponses += totalResponses;
            totals.windowSize.push(avgWindowSize);

            if (durationsRate) {
                totals.durationsRate.push(durationsRate);
            }
            if (roundTripTimeMs) {
                totals.roundTripTimeMs.push(roundTripTimeMs);
            }
        });

        const windowSize = mean(totals.windowSize);
        if (windowSize < this._config.statistics.maxSizeWindow / 2) {
            hasMaxSizeWindow = false;
        }

        // in case new scaler is up with not enough statistics, we will continue to accumulate
        const newScaleStats = currentSize > 0 && !hasMaxSizeWindow;

        if (!this._isStateful && !newScaleStats) {
            const avgQueueSize = Math.round(mean(totals.avgQueueSize));
            const durationsRate = mean(totals.durationsRate);
            this._getScaleDetails({ ...totals, avgQueueSize, durationsRate, currentSize });
        }
        this._metrics = { metrics, uidMetrics };
    }

    _logScaling({ action, replicas, currentSize, scaleTo }) {
        log.info(`scaling ${action} ${replicas} replicas for node ${this._nodeName} from ${currentSize} to ${scaleTo} replicas`, { component });
    }

    _scalingInterventionLog(action, required, allowed, customMessage = '') {
        const currentTime = Date.now();
        let sizeMessage = '';
        // Log-spam prevention
        if (this._interventionLogCallTrack.timeStamp) {
            if (this._interventionLogCallTrack.action === action
                && this._interventionLogCallTrack.required === required
                && this._interventionLogCallTrack.allowed.type === allowed.type
                && this._interventionLogCallTrack.allowed.size === allowed.size
                && currentTime - this._interventionLogCallTrack.timeStamp < this._config.scaleIntervention.throttleMs) {
                return;
            }
        }
        this._interventionLogCallTrack = { timeStamp: currentTime, action, required, allowed };
        if (action === this._limitActionType.both) {
            if (allowed?.size?.min) sizeMessage += `min-${allowed.size.min},`;
            if (allowed?.size?.max) sizeMessage += `max-${allowed.size.max},`;
            log.info(`scaling ${action} intervention, node ${this._nodeName} changed from required ${required}. ${sizeMessage} ${customMessage}`, { component });
            return;
        } // custom message for first intervention that handles required in both limits.
        log.info(`scaling ${action} intervention, node ${this._nodeName} changed from required ${required} to ${allowed.type}:${allowed.size}. ${customMessage}`, { component });
    }

    /**
     * Calculates and updates the required number of pods based on the current request metrics.
     *
     * @param {number} params.reqRate - The rate of incoming requests per second.
     * @param {number} params.totalRequests - The total number of requests received.
     * @param {number} params.totalResponses - The total number of responses sent.
     * @param {number} params.queueSize - The current size of the request queue.
     * @param {number} params.currentSize - The current number of pods.
     * @param {number} params.roundTripTimeMs - The average round trip time for a request in milliseconds.
     */
    _getScaleDetails({ reqRate, totalRequests, totalResponses, queueSize, currentSize, roundTripTimeMs }) {
        let neededPods = null;
        const { replicasOnFirstScale } = this._config.scaleUp;
        // first scale up
        if (totalRequests > 0 && totalResponses === 0 && currentSize === 0) {
            neededPods = this._capScaleByLimits(replicasOnFirstScale, this._limitActionType.both, 'Based on total requests, with initial size 0');
        }
        // scale up or down according to roundTrip, queue size and request rate
        else if (totalRequests > 0 && currentSize >= replicasOnFirstScale) {
            const requiredByRoundTrip = this._roundTripReplicas(queueSize, roundTripTimeMs, reqRate);
            neededPods = this._capScaleByLimits(requiredByRoundTrip, this._limitActionType.both, 'Based on round trip and predicted queue size');
        }
        if (neededPods !== null) {
            this._scaler.updateRequired(neededPods);
        }
    }

    /**
     * Caps the scaling of resources based on minimum and maximum limits.
     *
     * @param {number} required - The required number of resources.
     * @param {string} type - The limit type (`maxStateless`, `minStateless`, or `both`).
     * @param {string} [customMessage=''] - Optional custom message for logging.
     * @returns {number} - The adjusted scaling decision based on the limits.
     */
    _capScaleByLimits(required, type, customMessage = '') {
        let decision = required;
        const sizes = {};
        const { minStateless, maxStateless } = this._statelessCountLimits;

        switch (type) {
            case this._limitActionType.maxStateless:
                if (maxStateless && required > maxStateless) {
                    this._scalingInterventionLog('up', required, { type: this._limitActionType.maxStateless, size: maxStateless }, customMessage);
                    return maxStateless;
                }
                break;

            case this._limitActionType.minStateless:
                if (minStateless && required < minStateless) {
                    this._scalingInterventionLog('down', required, { type: this._limitActionType.minStateless, size: minStateless }, customMessage);
                    return minStateless;
                }
                break;

            case this._limitActionType.both:
                if (minStateless) {
                    decision = Math.max(decision, minStateless);
                    sizes.min = minStateless;
                }
                if (maxStateless) {
                    decision = Math.min(decision, maxStateless);
                    sizes.max = maxStateless;
                }
                this._scalingInterventionLog(this._limitActionType.both, required, { type: this._limitActionType.both, size: sizes }, customMessage);
                break;

            default:
                break;
        }
        return decision;
    }

    /**
     * Calculates the number of pods needed for scaling based on the current queue size,
     * round trip time, and request rate. Calculates estimated queue size.
     *
     * @param queueSize         the current size of the queue (number of requests waiting to be processed).
     * @param roundTripTimeMs   the average round trip time for a request in milliseconds.
     * @param reqRate           the rate of incoming requests per second.
     * @return                  the calculated number of pods required to handle the current queue size
     *                          and incoming request rate. Returns 1 if round trip time is zero; otherwise,
     *                          it calculates based on the queue size and request rate.
     */
    _roundTripReplicas(queueSize, roundTripTimeMs, reqRate) {
        if (!roundTripTimeMs) {
            return 1;
        }
        const podRate = 1000 / roundTripTimeMs; // pod response rate per second
        const timeToComplete = this._config.scaleUp.minTimeToCleanUpQueue; // in secounds
        const neededPods = Math.ceil((queueSize + reqRate * timeToComplete) / (timeToComplete * podRate));
        return neededPods;
    }

    // _addExtraReplicas(requiredByDurationRate, requiredByQueueSize) {
    //     const required = requiredByDurationRate + requiredByQueueSize;
    //     const totalRequired = required + Math.ceil(required * this._config.scaleUp.replicasExtra);
    //     return totalRequired;
    // }

    // _scaledQueueSize({ durationsRate, queueSize }) {
    //     if (!queueSize) {
    //         return 0;
    //     }
    //     if (!durationsRate) {
    //         return this._config.scaleUp.replicasOnFirstScale;
    //     }
    //     const msgCleanUp = Math.ceil(durationsRate * this._config.scaleUp.minTimeToCleanUpQueue);
    //     const requiredByQueueSize = Math.ceil(queueSize / msgCleanUp);
    //     return requiredByQueueSize;
    // }

    // _markQueueSize(avgQueueSize) {
    //     let canScaleDown = false;
    //     if (avgQueueSize <= this._config.scaleDown.minQueueSizeBeforeScaleDown) {
    //         const marker = this._queueSizeTime.mark();
    //         canScaleDown = marker.result;
    //     }
    //     else {
    //         this._queueSizeTime.unMark();
    //     }
    //     return canScaleDown;
    // }

    // _shouldIdleScaleDown({ reqRate, resRate }) {
    //     let time;
    //     let scale = false;
    //     if (!reqRate && !resRate) {
    //         const response = this._timeForDown.mark();
    //         if (response.result) {
    //             scale = true;
    //             time = response.time;
    //             this._timeForDown.unMark();
    //         }
    //     }
    //     return { scale, time };
    // }

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
        log.info(`CYCLE: worker Replicas #: ${tasks.length} added as tasks`);
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
        const { replicas, scaleTo } = scale; // currentSize
        const discoveryWorkers = discovery.getInstances(this._nodeName);
        // we will prefer not to scale-down masters, unless we scaling down to zero
        const instances = scaleTo === 0 ? discoveryWorkers : discoveryWorkers.filter(d => !d.isMaster);
        const workers = instances.slice(0, replicas);
        return Promise.all(workers.map(w => stateAdapter.stopWorker({ workerId: w.workerId })));
    }
}

module.exports = AutoScaler;
