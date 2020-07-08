const log = require('@hkube/logger').GetLogFromContainer();
const { componentName, queueEvents, metricsName, metricsTypes } = require('./consts/index');
const Queue = require('./queue');
const HeuristicRunner = require('./heuristic-runner');
const EnrichmentRunner = require('./enrichment-runner');
const enrichments = require('./enrichments/index');
const heuristic = require('./heuristic/index');
const Persistence = require('./persistency/persistence');
const aggregationMetricFactory = require('./metrics/aggregation-metrics-factory');

class QueueRunner {
    constructor() {
        this.queue = null;
        this.config = null;
        this.heuristicRunner = new HeuristicRunner();
        this.enrichmentRunner = new EnrichmentRunner();
    }

    async init(config) {
        log.info('queue runner started', { component: componentName.QUEUE_RUNNER });
        this.config = config;
        log.debug('start filling heuristics', { component: componentName.QUEUE_RUNNER });
        this.heuristicRunner.init(this.config.heuristicsWeights);
        Object.values(heuristic).map(v => this.heuristicRunner.addHeuristicToQueue(v));
        Object.values(enrichments).map(v => this.enrichmentRunner.addEnrichments(v));
        log.debug('calling to queue', { component: componentName.QUEUE_RUNNER });
        const persistence = await Persistence.init({ options: this.config });
        this.queue = new Queue({
            scoreHeuristic: this.heuristicRunner,
            updateInterval: this.config.queue.updateInterval,
            persistence,
            enrichmentRunner: this.enrichmentRunner
        });

        this.queue.on(queueEvents.UPDATE_SCORE, queueScore => aggregationMetricFactory.scoreHistogram(queueScore));

        this.queue.on(queueEvents.INSERT, (taskArr) => {
            taskArr.forEach(task => this._taskAdded(task));
        });

        this.queue.on(queueEvents.POP, (task) => {
            this._taskRemoved(task);
        });

        this.queue.on(queueEvents.REMOVE, (taskArr) => {
            taskArr.forEach(task => this._taskRemoved(task));
        });
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
