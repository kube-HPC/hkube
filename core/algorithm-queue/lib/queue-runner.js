const log = require('@hkube/logger').GetLogFromContainer();
const {componentName, queueEvents} = require('./consts/index');
const Queue = require('./queue');
const HeuristicRunner = require('./heuristic-runner');
const EnrichmentRunner = require('./enrichment-runner');
const enrichments = require('./enrichments/index');
const heuristic = require('./heuristic/index');
const Persistence = require('../lib/persistency/persistence');
const aggregationMetricFactory = require('./metrics/aggregation-metrics-factory');

class QueueRunner {
    constructor() {
        this.queue = null;
        this.config = null;
        this.heuristicRunner = new HeuristicRunner();
        this.enrichmentRunner = new EnrichmentRunner();
    }
        
    async init(config) {
        log.info('queue runner started', { component: componentName.QUEUE_RUNNER});
        this.config = config;
        log.debug('start filling heuristics', { component: componentName.QUEUE_RUNNER});
        this.heuristicRunner.init(this.config.heuristicsWeights);
        Object.values(heuristic).map(v => this.heuristicRunner.addHeuristicToQueue(v));
        Object.values(enrichments).map(v => this.enrichmentRunner.addEnrichments(v));
        log.debug('calling to queue', { component: componentName.QUEUE_RUNNER});
        const persistence = await Persistence.init({options: this.config});
        this.queue = new Queue({ 
            scoreHeuristic: this.heuristicRunner,
            updateInterval: this.config.queue.updateInterval,
            persistence, 
            enrichmentRunner: this.enrichmentRunner});
            
        this.queue.on(queueEvents.UPDATE_SCORE, queueScore => aggregationMetricFactory.scoreHistogram(queueScore));
    }
}


module.exports = new QueueRunner();
