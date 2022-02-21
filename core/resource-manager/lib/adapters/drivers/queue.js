const Adapter = require('../Adapter');
const stateManager = require('../../store/store-manager');
const combinedQueue = 'pipeline-driver';
class PipelineDriversQueueAdapter extends Adapter {
    constructor(options) {
        super(options);
    }

    async _getData() {
        const queue = await stateManager.getPipelineDriverQueue();
        queue.forEach(al => {
            al.data = al.data.map(a => ({ name: al.name, score: a }));
        });
        const combined = [{ name: combinedQueue, data: [] }];
        queue.forEach(al => {
            combined[0].data = combined[0].data.concat(al.data.map(a => ({ ...a, name: combinedQueue })));
        });
        return combined;
    }
}

module.exports = PipelineDriversQueueAdapter;
