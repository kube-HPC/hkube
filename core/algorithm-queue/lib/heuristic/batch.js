const heuristicsNames = require('../consts/heuristics-name');
const maxBatch = 1500;

// take barchPlace or max in order to normalize it to one 
const batch = {
    name: heuristicsNames.BATCH,
    algorithm: weight => job => weight * ((job.batchPlace < maxBatch ? Math.abs(job.batchPlace - (maxBatch + 1)) : maxBatch) / maxBatch)
    
};

module.exports = batch;
