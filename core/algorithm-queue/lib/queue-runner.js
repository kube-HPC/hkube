const Queue = require('./queue');
const HeuristicRunner = require('./heuristic-runner');
const Persistence = require('./persistency/persistence');
const EnrichmentRunner = require('./enrichment-runner');
const aggregationMetricFactory = require('./metrics/aggregation-metrics-factory');
const { queueEvents, metricsName, metricsTypes } = require('./consts/index');

class QueueRunner {
    create({ algorithmName, options }) {
        const scoreHeuristic = new HeuristicRunner(options.heuristicsWeights);
        const enrichmentRunner = new EnrichmentRunner();
        const queue = new Queue({
            algorithmName,
            updateInterval: options.queue.updateInterval,
            algorithmMinIdleTimeMS: options.algorithmQueueBalancer.algorithmMinIdleTimeMS,
            scoreHeuristic: (...args) => scoreHeuristic.run(...args),
            enrichmentRunner: (...args) => enrichmentRunner.run(...args),
            persistence: new Persistence({ algorithmName, maxScoringSize: options.scoring.maxSize }),
        });
        queue.on(queueEvents.UPDATE_SCORE, queueScore => aggregationMetricFactory.scoreHistogram(queueScore));
        queue.on(queueEvents.INSERT, (taskArr) => {
            taskArr.forEach(task => this._taskAdded(task));
        });
        queue.on(queueEvents.POP, (task) => {
            this._taskRemoved(task);
        });
        queue.on(queueEvents.REMOVE, (taskArr) => {
            taskArr.forEach(task => this._taskRemoved(task));
        });
        return queue;
    }

    _taskRemoved(task) {
        aggregationMetricFactory.getMetric(metricsName.TIME_IN_QUEUE)(task, metricsTypes.HISTOGRAM_OPERATION.end);
        aggregationMetricFactory.getMetric(metricsName.QUEUE_AMOUNT)(task, metricsTypes.GAUGE_OPERATION.decrease);
    }

    _taskAdded(task) {
        aggregationMetricFactory.getMetric(metricsName.TIME_IN_QUEUE)(task, metricsTypes.HISTOGRAM_OPERATION.start);
        aggregationMetricFactory.getMetric(metricsName.QUEUE_AMOUNT)(task, metricsTypes.GAUGE_OPERATION.increase);
        aggregationMetricFactory.getMetric(metricsName.QUEUE_COUNTER)(task, metricsTypes.COUNTER_OPERATION.increase);
    }
}

module.exports = new QueueRunner();
