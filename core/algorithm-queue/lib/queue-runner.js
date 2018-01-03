const Logger = require('@hkube/logger');
const components = require('./consts/component-name');
const log = Logger.GetLogFromContainer();


const Queue = require('./queue');
const HeuristicRunner = require('./heuristic-runner');
class QueueRunner {
    constructor() {
        this.queue = null;
        this.config = null;
        this.heuristicRunner = new HeuristicRunner();
    }
    init(config) {
        log.info('queue runner started', { component: components.QUEUE_RUNNER});
        this.config = config;
        this.heuristicRunner(this.config.heuristicsWeights);
        this.queue = new Queue({ scoreHeuristic: this.heuristicRunner.run, updateInterval: this.config.queue.updateInterval});
    }
}

module.exports = new QueueRunner();
