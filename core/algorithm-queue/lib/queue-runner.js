const Logger = require('@hkube/logger');
const components = require('./consts/component-name');
const log = Logger.GetLogFromContainer();
const Queue = require('./queue');
const HeuristicRunner = require('./heuristic-runner');
const heuristic = require('./heuristic');
class QueueRunner {
    constructor() {
        this.queue = null;
        this.config = null;
        this.heuristicRunner = new HeuristicRunner();
    }
    init(config) {
        log.info('queue runner started', { component: components.QUEUE_RUNNER});
        this.config = config;
        log.debug('start filling heuristics', { component: components.QUEUE_RUNNER});
        this.heuristicRunner(this.config.heuristicsWeights);
        this.heuristic.values.map(v => this.heuristicRunner.addHeuristicToQueue(v));
        log.debug('calling to queue', { component: components.QUEUE_RUNNER});
        this.queue = new Queue({ scoreHeuristic: this.heuristicRunner.run, updateInterval: this.config.queue.updateInterval});
    }
}

module.exports = new QueueRunner();
