const log = require('@hkube/logger').GetLogFromContainer();
const { componentName, queueEvents } = require('./consts');
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
        log.info('queue runner started', { component: componentName.QUEUE_RUNNER });
        this.config = config;
        this.heuristicRunner.init(this.config.heuristicsWeights);
        Object.values(heuristic).map(v => this.heuristicRunner.addHeuristicToQueue(v));
        log.debug('calling to queue', { component: componentName.QUEUE_RUNNER });
        const persistence = Persistence.init({ options: this.config });
        this.queue = new Queue({
            scoreHeuristic: this.heuristicRunner,
            updateInterval: this.config.queue.updateInterval,
            persistence
        });

        this.queue.on(queueEvents.UPDATE_SCORE, queueScore => aggregationMetricFactory.scoreHistogram(queueScore));
    }
}


module.exports = new QueueRunner();
