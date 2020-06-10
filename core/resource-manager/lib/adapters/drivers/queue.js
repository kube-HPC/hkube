const Adapter = require('../Adapter');
const stateManager = require('../../store/store-manager');

class PipelineDriversQueueAdapter extends Adapter {
    constructor(options) {
        super(options);
    }

    async _getData() {
        const queue = await stateManager.getPipelineDriverQueue();
        queue.forEach(al => {
            al.data = al.data.map(a => ({ name: al.name, score: a.score }));
        });
        return queue;
    }
}

module.exports = PipelineDriversQueueAdapter;
