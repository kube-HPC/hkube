const log = require('@hkube/logger').GetLogFromContainer();
const { componentName } = require('./consts');
const component = componentName.HEURISTIC_RUNNER;

class heuristicRunner {
    constructor() {
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

    run(job) {
        log.debug(`running heuristic for ${job.pipelineName}`, { component });
        const score = this.heuristicMap.reduce((result, algorithm) => {
            const heuristicScore = algorithm.heuristic(job);
            job.calculated.latestScores[algorithm.name] = heuristicScore;
            return result + heuristicScore;
        }, 0);
        log.debug(`finish heuristic for ${job.pipelineName} - score:${score}`, { component });
        return { ...job, score };
    }
}

module.exports = heuristicRunner;
