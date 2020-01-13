const Logger = require('@hkube/logger');
const { taskStatuses } = require('@hkube/consts');
const aigle = require('aigle');
const _ = require('lodash');
const components = require('./consts/component-name');

const log = Logger.GetLogFromContainer();

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
            this.heuristicMap.push({ name: heuristic.name, heuristic: heuristic.algorithm(this.heuristicsWeights[heuristic.name]), weight: this.heuristicsWeights[heuristic.name] });
        }
        else {
            log.info('couldnt find weight for heuristic ', { component: components.HEURISTIC_RUNNER });
        }
    }

    async run(job) {
        let score = 0;
        if (job.status !== taskStatuses.PRESCHEDULE) {
            log.debug('start running heuristic for ', { component: components.HEURISTIC_RUNNER });
            score = await this.heuristicMap.reduce((result, algorithm) => {
                const heuristicScore = algorithm.heuristic(job);
                job.calculated.latestScores[algorithm.name] = heuristicScore; // eslint-disable-line
                log.debug(
                    `during score calculation for ${algorithm.name} in ${job.jobId} 
                    score:${heuristicScore} calculated:${result + heuristicScore}`,
                    { component: components.HEURISTIC_RUNNER }
                );
                return result + heuristicScore;
            }, 0);
        }
        return { ...job, calculated: { ...job.calculated, score } };
    }
}

module.exports = heuristicRunner;
