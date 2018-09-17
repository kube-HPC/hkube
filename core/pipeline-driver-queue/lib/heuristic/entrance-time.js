/* eslint-disable */
const { heuristicsName } = require('../consts');
const maxTime = 3600000; // 1 hour

const entranceTime = {
    name: heuristicsName.ENTRANCE_TIME,
    algorithm: weight => job => (weight * (Date.now() - job.entranceTime) / maxTime) || 0.0001
};

module.exports = entranceTime;
