const orderBy = require('lodash.orderby');

const order = (queue, name) => {
    let newQueue = [];
    queue.forEach(q => newQueue.push(...q.data));
    newQueue = newQueue.map(m => ({ name, score: m.calculated.score }));
    newQueue = orderBy(newQueue, q => q.score, 'desc').map(() => ({ name }));
    newQueue.unshift(...queue.filter(q => q.pendingAmount > 0).map(() => ({ name })));
    return newQueue;
};

module.exports = {
    order
};
