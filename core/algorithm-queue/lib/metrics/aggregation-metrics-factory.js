const { metrics } = require('@hkube/metrics');
const log = require('@hkube/logger').GetLogFromContainer();
const { componentName, metricsName, metricsTypes, heuristicsName } = require('../consts/index');

class AggregationMetricsFactory {
    constructor() {
        this.timeInQueue = null;
        this.totalScore = null;
        this.batchScore = null;
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
            description: 'Histogram of task time spent in queue',
            labels: ['pipeline_name', 'algorithm_name', 'node_name'],
            buckets: [1, 2, 4, 8, 16, 32, 64, 128, 256].map(t => t * 1000)
        });
        this.totalScore = metrics.addTimeMeasure({
            name: metricsName.TOTAL_SCORE,
            description: 'Histogram of queued tasks total score',
            labels: ['pipeline_name', 'algorithm_name', 'node_name'],
            buckets: [...Array(100).keys()]
        });
        this.batchScore = metrics.addTimeMeasure({
            name: metricsName.BATCH_SCORE,
            description: 'Histogram of queued tasks batch score',
            labels: ['pipeline_name', 'algorithm_name', 'node_name'],
            buckets: [...Array(100).keys()]
        });
        this.timeScore = metrics.addTimeMeasure({
            name: metricsName.TIME_SCORE,
            description: 'Histogram of queued tasks time score',
            labels: ['pipeline_name', 'algorithm_name', 'node_name'],
            buckets: [...Array(100).keys()]
        });
        this.priorityScore = metrics.addTimeMeasure({
            name: metricsName.PRIORITY_SCORE,
            description: 'Histogram of queued tasks priority score',
            labels: ['pipeline_name', 'algorithm_name', 'node_name'],
            buckets: [...Array(100).keys()]
        });

        this.queueAmount = metrics.addGaugeMeasure({
            name: metricsName.QUEUE_AMOUNT,
            description: 'Tasks queue size',
            labels: ['pipeline_name', 'algorithm_name', 'node_name'],
        });
        this.queueCounter = metrics.addCounterMeasure({
            name: metricsName.QUEUE_COUNTER,
            description: 'Total number of tasks pushed to queue',
            labels: ['pipeline_name', 'algorithm_name', 'nodeName'],
        });
        this._metrics = {
            score: {
                instance: [this.totalScore, this.batchScore, this.priorityScore, this.timeScore],
                type: metricsTypes.HISTOGRAM_OPERATION,
                method: (metric, task, metricOperation) => this._histogram(metric, task, metricOperation)
            },
            [metricsName.TOTAL_SCORE]: {
                instance: [this.totalScore],
                type: metricsTypes.HISTOGRAM_OPERATION,
                method: (metric, task, metricOperation) => this._histogram(metric, task, metricOperation)
            },
            [metricsName.TIME_IN_QUEUE]: {
                instance: [this.timeInQueue],
                type: metricsTypes.HISTOGRAM_OPERATION,
                method: (metric, task, metricOperation) => this._histogram(metric, task, metricOperation)
            },
            [metricsName.BATCH_SCORE]: {
                instance: [this.batchScore],
                type: metricsTypes.HISTOGRAM_OPERATION,
                method: (metric, task, metricOperation) => this._histogram(metric, task, metricOperation)
            },
            [metricsName.PRIORITY_SCORE]: {
                instance: [this.priorityScore],
                type: metricsTypes.HISTOGRAM_OPERATION,
                method: (metric, task, metricOperation) => this._histogram(metric, task, metricOperation)
            },
            [metricsName.TIME_SCORE]: {
                instance: [this.timeScore],
                type: metricsTypes.HISTOGRAM_OPERATION,
                method: (metric, task, metricOperation) => this._histogram(metric, task, metricOperation)
            },
            [metricsName.QUEUE_AMOUNT]: {
                instance: [this.queueAmount],
                type: metricsTypes.GAUGE,
                method: (metric, task, metricOperation) => this._gauge(metric, task, metricOperation)
            },
            [metricsName.QUEUE_COUNTER]: {
                instance: [this.queueCounter],
                type: metricsTypes.COUNTER,
                method: (metric, task, metricOperation) => this._counter(metric, task, metricOperation)
            }
        };
    }

    get get() {
        return this._metrics;
    }

    getMetric(type) {
        return (task, metricOperation) => this._metrics[type].method(this._metrics[type].instance[0], task, metricOperation);
    }

    scoreHistogram(queue) {
        if (queue.length === 0) {
            return;
        }
        queue.forEach(task => this._scoreTask(task));
    }

    _scoreTask(task) {
        try {
            const labelValues = {
                pipeline_name: task.pipelineName,
                algorithm_name: task.algorithmName,
                node_name: task.nodeName
            };
            this._metrics[metricsName.BATCH_SCORE].instance[0].retroactive({
                labelValues,
                time: task.calculated.latestScores[heuristicsName.BATCH]
            });
            this._metrics[metricsName.PRIORITY_SCORE].instance[0].retroactive({
                labelValues,
                time: task.calculated.latestScores[heuristicsName.PRIORITY]
            });
            this._metrics[metricsName.TIME_SCORE].instance[0].retroactive({
                labelValues,
                time: task.calculated.latestScores[heuristicsName.ENTRANCE_TIME]
            });
            this._metrics[metricsName.TOTAL_SCORE].instance[0].retroactive({
                labelValues,
                time: task.calculated.score || 0.00001
            });
        }
        catch (error) {
            log.warning(`cant init metrics ${error}`, { component: componentName.AGGREGATION_METRIC });
        }
    }

    /**
     * Apply operation on histogram metric
     * @param {Object} metric
     * @param {Object} task
     * @param {string} metricOperation
     */
    _histogram(metric, task, metricOperation) {
        const metricData = {
            id: `${task.taskId}-${task.status}`,
            labelValues: {
                pipeline_name: task.pipelineName,
                algorithm_name: task.algorithmName,
                node_name: task.nodeName
            }
        };
        try {
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
        catch (error) {
            log.warning(`metrics error ${error}`, { component: componentName.AGGREGATION_METRIC });
        }
    }

    /**
     * Apply operation on gauge metric
     * @param {Object} metric
     * @param {Object} task
     * @param {string} metricOperation
     */
    _gauge(metric, task, metricOperation) {
        const metricData = {
            id: task.taskId,
            labelValues: {
                pipeline_name: task.pipelineName,
                algorithm_name: task.algorithmName,
                node_name: task.nodeName
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
    _counter(metric, task, metricOperation) {
        const metricData = {
            id: task.taskId,
            labelValues: {
                pipeline_name: task.pipelineName,
                algorithm_name: task.algorithmName,
                node_name: task.nodeName
            }
        };
        if (metricOperation === metricsTypes.COUNTER_OPERATION.increase) {
            metric.inc(metricData);
        }
    }
}

module.exports = new AggregationMetricsFactory();
