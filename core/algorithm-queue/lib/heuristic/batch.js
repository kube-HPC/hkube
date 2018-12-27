/* eslint-disable */
const heuristicsNames = require('../consts/heuristics-name');
const maxBatch = 1500;
// take batchPlace or max in order to normalize it to one 
const batch = {
    name: heuristicsNames.BATCH,
    algorithm: weight => job => weight * ((job.batchIndex < maxBatch ? Math.abs(job.batchIndex - (maxBatch + 1)) : maxBatch) / maxBatch)

};

module.exports = batch;
