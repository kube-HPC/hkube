const orderBy = require('lodash.orderby');
const utils = require('../utils/utils');

const order = (queue) => {
    let algorithmQueue = [];
    queue.forEach(q => algorithmQueue.push(...q.data));
    algorithmQueue = orderBy(algorithmQueue, q => q.score, 'desc').map(m => ({ name: m.name }));
    algorithmQueue.unshift(...queue.filter(q => q.pendingAmount > 0).map(q => ({ name: q.queueName })));
    return algorithmQueue;
};

const normalize = (queue, results) => {
    const map = Object.create(null);
    queue.forEach(q => {
        map[q.queueName] = results[q.queueName] || 0;
    });
    return utils.mapToArray(map, ['name', 'data']);
};

module.exports = {
    order,
    normalize
};
