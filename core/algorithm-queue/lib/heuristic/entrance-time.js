const heuristicsNames = require('../consts/heuristics-name');
const entranceTime = {
    name: heuristicsNames.ENTRANCE_TIME,
    algorithm: weight => job => weight * (Date.now() - job.calculated.entranceTime)
    
};

module.exports = entranceTime;
