const Logger = require('@hkube/logger');
const components = require('./consts/component-name');
const log = Logger.GetLogFromContainer();
const _ = require('lodash');
const aigle = require('aigle');
const heuristicType = {
    name: 'name',
    algorithm: weight => async job => job.score
};
// runs heuristic on a single job
class heuristicRunner {
    constructor() {
        aigle.mixin(_);
        this.config = null;
        this.heuristicMap = [];
    }
    init(heuristicsWeights) {
        // this.config = config;
        this.heuristicsWeights = heuristicsWeights;
        log.info('', { component: components.WEBHOOK_HANDLER });
    }
    addHeuristicToQueue(heuristic) {
        if (this.heuristicsWeights[heuristic.name]) {
            this.heuristicMap.push({heuristic: heuristic.algorithm(this.heuristicsWeights[heuristic.name]), weight: this.heuristicsWeights[heuristic.name]});
        }
        else {
            log.info('couldent find weight for hurustic ', { component: components.Heuristic_RUNNER});
        }
    }
    async run(job) {
        const score = await this.heuristicMap.reduce((result, algorithm) => result + algorithm(job), 0);
        return {...job, calculated: { score}};
    }
}

module.exports = heuristicRunner;
