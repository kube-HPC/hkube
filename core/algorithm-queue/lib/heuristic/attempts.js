/* eslint-disable */
const heuristicsNames = require('../consts/heuristics-name');
const maxAttempts = 3;
const attempts = {
    name: heuristicsNames.ATTEMPTS,
    algorithm: weight => job => weight * job.attempts / maxAttempts
};

module.exports = attempts;

