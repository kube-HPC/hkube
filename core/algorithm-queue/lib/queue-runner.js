const log = require('@hkube/logger').GetLogFromContainer();
const components = require('./consts/component-name');
const Queue = require('./queue');
const HeuristicRunner = require('./heuristic-runner');
const heuristic = require('./heuristic/index');
const Persistence = require('../lib/persistency/persistence');

class QueueRunner {
    constructor() {
        this.queue = null;
        this.config = null;
        this.heuristicRunner = new HeuristicRunner();
    }
        
    async init(config) {
        log.info('queue runner started', { component: components.QUEUE_RUNNER});
        this.config = config;
        log.debug('start filling heuristics', { component: components.QUEUE_RUNNER});
        this.heuristicRunner.init(this.config.heuristicsWeights);
        Object.values(heuristic).map(v => this.heuristicRunner.addHeuristicToQueue(v));
        log.debug('calling to queue', { component: components.QUEUE_RUNNER});
        const persistence = Persistence.init({options: this.config});
        this.queue = new Queue({ scoreHeuristic: this.heuristicRunner, updateInterval: this.config.queue.updateInterval, persistence});
    }
}


module.exports = new QueueRunner();
