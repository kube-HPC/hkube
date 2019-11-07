const { queueEvents, metricsName, metricsTypes } = require('./consts');
const Queue = require('./queue');
const HeuristicRunner = require('./heuristic-runner');
const heuristic = require('./heuristic');
const Persistence = require('../lib/persistency/persistence');
const aggregationMetricFactory = require('./metrics/aggregation-metrics-factory');

class QueueRunner {
    constructor() {
        this.queue = null;
        this.config = null;
        this.heuristicRunner = new HeuristicRunner();
    }

    async init(config) {
        this.config = config;
        this.heuristicRunner.init(this.config.heuristicsWeights);
        Object.values(heuristic).map(v => this.heuristicRunner.addHeuristicToQueue(v));
        const persistence = await Persistence.init({ options: this.config });
        this.queue = new Queue({
            scoreHeuristic: this.heuristicRunner,
            persistence
        });

        this.queue.on(queueEvents.UPDATE_SCORE, job => aggregationMetricFactory.updateScoreMetrics(job));
        this.queue.on(queueEvents.INSERT, job => this._jobAdded(job));
        this.queue.on(queueEvents.POP, job => this._jobRemoved(job));
        this.queue.on(queueEvents.REMOVE, job => this._jobRemoved(job));
        await this.queue.persistencyLoad();
    }

    _jobAdded(job) {
        aggregationMetricFactory.getMetric(metricsName.TIME_IN_QUEUE)(job, metricsTypes.HISTOGRAM_OPERATION.start);
        aggregationMetricFactory.getMetric(metricsName.QUEUE_AMOUNT)(job, metricsTypes.GAUGE_OPERATION.increase);
        aggregationMetricFactory.getMetric(metricsName.QUEUE_COUNTER)(job, metricsTypes.COUNTER_OPERATION.increase);
    }

    _jobRemoved(job) {
        aggregationMetricFactory.getMetric(metricsName.TIME_IN_QUEUE)(job, metricsTypes.HISTOGRAM_OPERATION.end);
        aggregationMetricFactory.getMetric(metricsName.QUEUE_AMOUNT)(job, metricsTypes.GAUGE_OPERATION.decrease);
    }
}

module.exports = new QueueRunner();
