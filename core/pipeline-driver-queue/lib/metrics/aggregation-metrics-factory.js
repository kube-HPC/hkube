const { metrics } = require('@hkube/metrics');
const log = require('@hkube/logger').GetLogFromContainer();
const { componentName, metricsName, metricsTypes, heuristicsName } = require('../consts');

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
            labels: ['pipeline_name', 'algorithm_name', 'node_name'],
            buckets: [1, 2, 4, 8, 16, 32, 64, 128, 256].map(t => t * 1000)
        });
        this.totalScore = metrics.addTimeMeasure({
            name: metricsName.TOTAL_SCORE,
            labels: ['pipeline_name', 'algorithm_name', 'node_name'],
            buckets: [...Array(100).keys()]
        });
        this.batchScore = metrics.addTimeMeasure({
            name: metricsName.BATCH_SCORE,
            labels: ['pipeline_name', 'algorithm_name', 'node_name'],
            buckets: [...Array(100).keys()]
        });
        this.timeScore = metrics.addTimeMeasure({
            name: metricsName.TIME_SCORE,
            labels: ['pipeline_name', 'algorithm_name', 'node_name'],
            buckets: [...Array(100).keys()]
        });
        this.priorityScore = metrics.addTimeMeasure({
            name: metricsName.PRIORITY_SCORE,
            labels: ['pipeline_name', 'algorithm_name', 'node_name'],
            buckets: [...Array(100).keys()]
        });

        this.queueAmount = metrics.addGaugeMeasure({
            name: metricsName.QUEUE_AMOUNT,
            labels: ['pipeline_name', 'algorithm_name', 'node_name'],
        });
        this.queueCounter = metrics.addCounterMeasure({
            name: metricsName.QUEUE_COUNTER,
            labels: ['pipeline_name', 'algorithm_name', 'nodeName'],
        });
        this._metrics = {
            score: {
                instance: [this.totalScore, this.batchScore, this.priorityScore, this.timeScore],
                type: metricsTypes.HISTOGRAM_OPERATION,
                method: (task, metricOperation) => this._scoreHistogram('score', task, metricOperation)
            },
            [metricsName.TOTAL_SCORE]: {
                instance: [this.timeScore],
                type: metricsTypes.HISTOGRAM_OPERATION,
                method: (task, metricOperation) => this._histogram(metricsName.TOTAL_SCORE, task, metricOperation)
            },
            [metricsName.TIME_IN_QUEUE]: {
                instance: [this.totalScore],
                type: metricsTypes.HISTOGRAM_OPERATION,
                method: (task, metricOperation) => this._histogram(metricsName.TIME_IN_QUEUE, task, metricOperation)
            },
            [metricsName.BATCH_SCORE]: {
                instance: [this.batchScore],
                type: metricsTypes.HISTOGRAM_OPERATION,
                method: (task, metricOperation) => this._histogram(metricsName.BATCH_SCORE, task, metricOperation)
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
            [metricsName.QUEUE_AMOUNT]: { instance: this.queueAmount, type: metricsTypes.GAUGE },
            [metricsName.QUEUE_COUNTER]: { instance: this.queueCounter, type: metricsTypes.COUNTER }


        };
    }

    get get() {
        return this._metrics;
    }
    getMetric(type) {
        return (task, metricOperation) => this._metrics[type].method(this._metrics[type].instance, task, metricOperation);
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
            this._metrics[metricsName.PRIORITY_SCORE].instance[0].retroactive({
                labelValues,
                time: task.calculated.latestScores[heuristicsName.PRIORITY]
            });
            this._metrics[metricsName.TIME_SCORE].instance[0].retroactive({
                labelValues,
                time: task.calculated.score
            });
            this._metrics[metricsName.TOTAL_SCORE].instance[0].retroactive({
                labelValues,
                time: task.calculated.latestScores[heuristicsName.ENTRANCE_TIME]
            });
        }
        catch (error) {
            log.error(`cant init metrics ${error}`, { component: componentName.AGGREGATION_METRIC });
        }
    }
    _histogram(metric, task, metricOperation) {
        const metricData = {
            id: task.data.taskID,
            labelValues: {
                pipeline_name: task.data.pipeline_name,
                algorithm_name: this._options.jobConsumer.job.type
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
}

// 'Aggregation'
module.exports = new AggregationMetricsFactory();
