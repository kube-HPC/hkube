const Logger = require('@hkube/logger');
const { taskStatuses } = require('@hkube/consts');
const heuristics = require('./heuristic/index');
const component = require('./consts/component-name').HEURISTIC_RUNNER;
const log = Logger.GetLogFromContainer();

class heuristicRunner {
    constructor(heuristicsWeights) {
        this.heuristicMap = [];
        Object.values(heuristics).map(v => this.addHeuristicToQueue(heuristicsWeights, v));
    }

    addHeuristicToQueue(heuristicsWeights, heuristic) {
        if (heuristicsWeights[heuristic.name]) {
            this.heuristicMap.push({ name: heuristic.name, heuristic: heuristic.algorithm(heuristicsWeights[heuristic.name]), weight: heuristicsWeights[heuristic.name] });
        }
        else {
            log.info('couldnt find weight for heuristic ', { component });
        }
    }

    run(job) {
        let score = 0;
        if (job.status !== taskStatuses.PRESCHEDULE) {
            log.debug('start running heuristic for ', { component });
            score = this.heuristicMap.reduce((result, algorithm) => {
                const heuristicScore = algorithm.heuristic(job);
                log.debug(`during score calculation for ${algorithm.name} in ${job.jobId} score:${heuristicScore} calculated:${result + heuristicScore}`, { component });
                return result + heuristicScore;
            }, 0);
        }
        return { ...job, score };
    }
}

module.exports = heuristicRunner;
