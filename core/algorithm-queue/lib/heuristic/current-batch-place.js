/* eslint-disable */
const heuristicsNames = require('../consts/heuristics-name');

// take batchPlace or max in order to normalize it to one 
const currentBatchPlaceHeuristic = {
    name: heuristicsNames.CURRENT_BATCH_PLACE,
    algorithm: weight => (job) => {
        const { currentBatchPlace, currentBatchLength } = job.calculated.enrichment.batchIndex;
        // use abs in order to give more wight to jobs in the Front
        const score = currentBatchPlace != null ? weight * (Math.abs(currentBatchPlace - (currentBatchLength + 1)) / currentBatchLength) : 0;

        return score;
    }

};

module.exports = currentBatchPlaceHeuristic;
