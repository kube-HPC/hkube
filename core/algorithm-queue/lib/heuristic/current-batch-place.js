const heuristicsNames = require('../consts/heuristics-name');
const maxBatch = 1500;

// take barchPlace or max in order to normalize it to one 
const currentBatchPlaceHeuristic = {
    name: heuristicsNames.CURRENT_BATCH_PLACE,
    algorithm: weight => job => {
        if (!job.calculated.enrichment.batchPlace) {
            job.calculated.enrichment.batchPlace = {};
        }

        const {currentBatchPlace, currentBatchLength} = job.calculated.enrichment.batchPlace;
        // use abs in order to give more wight to jobs in the Front
        const score = currentBatchPlace != null ? weight * (Math.abs(currentBatchPlace - (currentBatchLength + 1)) / currentBatchLength) : 0;
        
        return score;
    }
    
};

module.exports = currentBatchPlaceHeuristic;
