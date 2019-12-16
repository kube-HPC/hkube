const { metrics } = require('@hkube/metrics');
const log = require('@hkube/logger').GetLogFromContainer();
const { componentName, metricsName, metricsTypes, heuristicsName } = require('../consts');

class AggregationMetricsFactory {
    constructor() {
        this.timeInQueue = null;
        this.totalScore = null;
        this.priorityScore = null;
        this.timeScore = null;
        this.queueAmount = null;
        this.queueCounter = null;
        this.metricsMaps = {};
        this._options = null;
    }

    async init(options) {
        this._options = options;
        await metrics.init(this._options.metrics);
        this._register();
    }

    _register() {
        this.timeInQueue = metrics.addTimeMeasure({
            name: metricsName.TIME_IN_QUEUE,
            description: 'Histogram of job time spent in queue',
            labels: ['pipeline_name'],
            buckets: [1, 2, 4, 8, 16, 32, 64, 128, 256].map(t => t * 1000)
        });
        this.totalScore = metrics.addTimeMeasure({
            name: metricsName.TOTAL_SCORE,
            description: 'Histogram of queued jobs total score',
            labels: ['pipeline_name'],
            buckets: [...Array(100).keys()]
        });
        this.timeScore = metrics.addTimeMeasure({
            name: metricsName.TIME_SCORE,
            description: 'Histogram of queued jobs time score',
            labels: ['pipeline_name'],
            buckets: [...Array(100).keys()]
        });
        this.priorityScore = metrics.addTimeMeasure({
            name: metricsName.PRIORITY_SCORE,
            description: 'Histogram of queued jobs priority score',
            labels: ['pipeline_name'],
            buckets: [...Array(100).keys()]
        });
        this.queueAmount = metrics.addGaugeMeasure({
            name: metricsName.QUEUE_AMOUNT,
            description: 'Jobs queue size',
            labels: ['pipeline_name'],
        });
        this.queueCounter = metrics.addCounterMeasure({
            name: metricsName.QUEUE_COUNTER,
            description: 'Total number of jobs pushed to queue',
            labels: ['pipeline_name'],
        });
        this._metrics = {
            score: {
                instance: [this.totalScore, this.priorityScore, this.timeScore],
                type: metricsTypes.HISTOGRAM_OPERATION,
                method: (job, metricOperation) => this._scoreHistogram('score', job, metricOperation)
            },
            [metricsName.TOTAL_SCORE]: {
                instance: [this.totalScore],
                type: metricsTypes.HISTOGRAM_OPERATION,
                method: (task, metricOperation) => this._histogram(metricsName.TOTAL_SCORE, task, metricOperation)
            },
            [metricsName.TIME_IN_QUEUE]: {
                instance: [this.timeInQueue],
                type: metricsTypes.HISTOGRAM_OPERATION,
                method: (metric, task, metricOperation) => this._histogram(metric, task, metricOperation)
            },
            [metricsName.PRIORITY_SCORE]: {
                instance: [this.priorityScore],
                type: metricsTypes.HISTOGRAM_OPERATION,
                method: (task, metricOperation) => this._histogram(metricsName.PRIORITY_SCORE, task, metricOperation)
            },
            [metricsName.TIME_SCORE]: {
                instance: [this.timeScore],
                type: metricsTypes.HISTOGRAM_OPERATION,
                method: (task, metricOperation) => this._histogram(metricsName.TIME_SCORE, task, metricOperation)
            },
            [metricsName.QUEUE_AMOUNT]: {
                instance: [this.queueAmount],
                type: metricsTypes.GAUGE,
                method: (metric, job, metricOperation) => this._gauge(metric, job, metricOperation)
            },
            [metricsName.QUEUE_COUNTER]: {
                instance: [this.queueCounter],
                type: metricsTypes.COUNTER,
                method: (metric, job, metricOperation) => this._counter(metric, job, metricOperation)
            }
        };
    }

    get get() {
        return this._metrics;
    }

    getMetric(type) {
        return (job, metricOperation) => {
            try {
                this._metrics[type].method(this._metrics[type].instance[0], job, metricOperation);
            }
            catch (error) {
                log.throttle.warning(`metrics error ${error}`, { component: componentName.AGGREGATION_METRIC });
            }
        };
    }

    scoreHistogram(queue) {
        if (queue.length === 0) {
            return;
        }
        queue.forEach(job => this.updateScoreMetrics(job));
    }

    /**
     * set score metrics for given job
     * @param {Object} job
     */
    updateScoreMetrics(job) {
        const { pipelineName } = job;
        try {
            const labelValues = {
                pipeline_name: pipelineName
            };
            this._metrics[metricsName.PRIORITY_SCORE].instance[0].retroactive({
                labelValues,
                time: job.calculated.latestScores[heuristicsName.PRIORITY]
            });
            this._metrics[metricsName.TIME_SCORE].instance[0].retroactive({
                labelValues,
                time: job.calculated.latestScores[heuristicsName.ENTRANCE_TIME]
            });
            this._metrics[metricsName.TOTAL_SCORE].instance[0].retroactive({
                labelValues,
                time: job.score
            });
        }
        catch (error) {
            log.error(`cant init metrics ${error}`, { component: componentName.AGGREGATION_METRIC });
        }
    }

    /**
     * Apply operation on histogram metric
     * @param {Object} metric
     * @param {Object} task
     * @param {string} metricOperation
     */
    _histogram(metric, job, metricOperation) {
        const { pipelineName } = job;
        const metricData = {
            id: job.jobId,
            labelValues: {
                pipeline_name: pipelineName
            }
        };
        if (metricOperation === metricsTypes.HISTOGRAM_OPERATION.start) {
            metric.start(metricData);
        }
        else if (metricOperation === metricsTypes.HISTOGRAM_OPERATION.end) {
            metric.end(metricData);
        }

        else if (metricOperation === metricsTypes.HISTOGRAM_OPERATION.retroActive) {
            metric.retroactive({ labelValues: metricData.labelValues });
        }
    }

    /**
     * Apply operation on gauge metric
     * @param {Object} metric
     * @param {Object} task
     * @param {string} metricOperation
     */
    _gauge(metric, job, metricOperation) {
        const { pipelineName } = job;
        const metricData = {
            id: job.jobId,
            labelValues: {
                pipeline_name: pipelineName
            }
        };
        if (metricOperation === metricsTypes.GAUGE_OPERATION.increase) {
            metric.inc(metricData);
        }
        else if (metricOperation === metricsTypes.GAUGE_OPERATION.decrease) {
            metric.dec(metricData);
        }
    }

    /**
     * Apply operation on counter metric
     * @param {Object} metric
     * @param {Object} task
     * @param {string} metricOperation
     */
    _counter(metric, job, metricOperation) {
        const { pipelineName } = job;
        const metricData = {
            id: job.jobId,
            labelValues: {
                pipeline_name: pipelineName
            }
        };
        if (metricOperation === metricsTypes.COUNTER_OPERATION.increase) {
            metric.inc(metricData);
        }
    }
}

// 'Aggregation'
module.exports = new AggregationMetricsFactory();
