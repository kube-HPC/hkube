const Adapter = require('../Adapter');
const stateManager = require('../../store/store-manager');

class AlgorithmQueueAdapter extends Adapter {
    constructor(options) {
        super(options);
    }

    async _getData() {
        const queue = await stateManager.getAlgorithmQueue();
        queue.forEach(al => {
            al.data = al.data.map(a => ({ name: al.name, score: a }));
        });
        return queue;
    }
}

module.exports = AlgorithmQueueAdapter;
