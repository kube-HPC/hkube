const Logger = require('@hkube/logger');
const components = require('./consts/component-name');
const log = Logger.GetLogFromContainer();
const _ = require('lodash');
const aigle = require('aigle');
// const heuristicType = {
//     name: 'name',
//     algorithm: weight => async job => job.score
// };
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
        log.info('heuristic wights was set', { component: components.HEURISTIC_RUNNER });
    }
    // add heuristic 
    addHeuristicToQueue(heuristic) {
        if (this.heuristicsWeights[heuristic.name]) {
            this.heuristicMap.push({ name: heuristic.name, heuristic: heuristic.algorithm(this.heuristicsWeights[heuristic.name]), weight: this.heuristicsWeights[heuristic.name]});
        }
        else {
            log.info('couldnt find weight for heuristic ', { component: components.HEURISTIC_RUNNER});
        }
    }
    async run(job) {
        log.debug('start running heuristic for ', { component: components.HEURISTIC_RUNNER});
        const score = await this.heuristicMap.reduce((result, algorithm) => {
            const score = algorithm.heuristic(job);
            job.calculated.latestScores[algorithm.name] = score;
            log.info(`during score calculation for ${algorithm.name} in ${job.jobId} 
                    score:${score} calculated:${result + score}`, { component: components.HEURISTIC_RUNNER});
            return result + score;
        }, 0);
        return {...job, calculated: {...job.calculated, score}};
    }
}

module.exports = heuristicRunner;
