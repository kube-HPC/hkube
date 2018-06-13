const log = require('@hkube/logger').GetLogFromContainer();
const component = require('./consts/component-name').HEURISTIC_RUNNER;
const _ = require('lodash');
const aigle = require('aigle');

class heuristicRunner {
    constructor() {
        aigle.mixin(_);
        this.heuristicMap = [];
    }

    init(heuristicsWeights) {
        this.heuristicsWeights = heuristicsWeights;
    }

    addHeuristicToQueue(heuristic) {
        if (this.heuristicsWeights[heuristic.name]) {
            this.heuristicMap.push({ name: heuristic.name, heuristic: heuristic.algorithm(this.heuristicsWeights[heuristic.name]), weight: this.heuristicsWeights[heuristic.name] });
        }
        else {
            log.info('couldnt find weight for heuristic', { component });
        }
    }

    async run(job) {
        // log.debug('start running heuristic for ', { component });
        const score = await this.heuristicMap.reduce((result, algorithm) => {
            const heuristicScore = algorithm.heuristic(job);
            job.calculated.latestScores[algorithm.name] = heuristicScore;
            // log.debug(`${algorithm.name} - score:${heuristicScore} calculated:${result + heuristicScore}`, { component });
            return result + heuristicScore;
        }, 0);
        log.debug(`${job.pipelineName} - score:${score}`, { component });
        return { ...job, calculated: { ...job.calculated, score } };
    }
}

module.exports = heuristicRunner;
