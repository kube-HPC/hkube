// const { queueEvents } = require('./consts');
const Queue = require('./queue');
const HeuristicRunner = require('./heuristic-runner');
const heuristic = require('./heuristic');
const Persistence = require('../lib/persistency/persistence');
// const aggregationMetricFactory = require('./metrics/aggregation-metrics-factory');

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
        // this.queue.on(queueEvents.UPDATE_SCORE, queueScore => aggregationMetricFactory.scoreHistogram(queueScore));
    }
}

module.exports = new QueueRunner();
