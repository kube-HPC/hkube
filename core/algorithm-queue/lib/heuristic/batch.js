const heuristicsNames = require('../consts/heuristics-name');
const batch = {
    name: heuristicsNames.BATCH,
    algorithm: weight => job => weight * job.batchPlace
    
};

module.exports = batch;
