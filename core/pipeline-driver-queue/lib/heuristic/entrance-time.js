/* eslint-disable */
const heuristicsNames = require('../consts/heuristics-name');
const maxTime = 3600000; // 1 hour

const entranceTime = {
    name: heuristicsNames.ENTRANCE_TIME,
    algorithm: weight => job => weight * (Date.now() - job.entranceTime) / maxTime
};

module.exports = entranceTime;
