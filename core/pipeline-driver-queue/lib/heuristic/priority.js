/* eslint-disable */
const { heuristicsName } = require('../consts');
const maxPriority = 5;

const priority = {
    name: heuristicsName.PRIORITY,
    // whight * absolute+1- priority(in order to invert the most prioretized from 5 to 1)/ max priority  
    algorithm: weight => job => weight * (Math.abs(maxPriority + 1 - job.priority)) / maxPriority
};

module.exports = priority;

