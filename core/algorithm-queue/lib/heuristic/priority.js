const heuristicsNames = require('../consts/heuristics-name');
const priority = {
    name: heuristicsNames.PRIORITY,
    algorithm: weight => job => weight * job.priority
    
};

module.exports = priority;

