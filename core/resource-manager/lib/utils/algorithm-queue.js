const orderBy = require('lodash.orderby');
const utils = require('../utils/utils');

const order = (queue) => {
    let algorithmQueue = [];
    queue.forEach(q => algorithmQueue.push(...q.data));
    algorithmQueue = algorithmQueue.map(q => ({ name: q.algorithmName, score: q.calculated.score }));
    algorithmQueue = orderBy(algorithmQueue, q => q.score, 'desc');
    return algorithmQueue;
}

const normalize = (queue, results) => {
    const map = Object.create(null);
    queue.forEach(q => {
        map[q.queueName] = results[q.queueName] || 0;
    });
    return utils.mapToArray(map, ['name', 'data']);
}

module.exports = {
    order,
    normalize
}