const orderBy = require('lodash.orderby');
const utils = require('../utils/utils');

const order = (queue) => {
    let newQueue = [];
    queue.forEach(q => newQueue.push(...q.data));
    newQueue = orderBy(newQueue, q => q.score, 'desc').map(m => ({ name: m.name }));
    newQueue.unshift(...queue.filter(q => q.pendingAmount > 0).map(q => ({ name: q.name })));
    return newQueue;
};

const normalize = (queue, results) => {
    const map = Object.create(null);
    queue.forEach(q => {
        map[q.name] = results[q.name] || 0;
    });
    return utils.mapToArray(map, ['name', 'data']);
};

module.exports = {
    order,
    normalize
};
