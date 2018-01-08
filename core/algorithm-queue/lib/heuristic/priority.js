const heuristicsNames = require('../consts/heuristics-name');
const priority = {
    name: heuristicsNames.PRIORITY,
    algorithm: weight => job => weight * Math.abs(job.priority - 5)
    
};

module.exports = priority;

