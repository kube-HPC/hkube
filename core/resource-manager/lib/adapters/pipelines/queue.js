const Adapter = require('./../Adapter');
const stateManager = require('../../state/state-manager');

class PipelineDriversQueueAdapter extends Adapter {
    constructor(options) {
        super(options);
    }

    async _getData() {
        const queue = await stateManager.getPipelineDriverQueue();
        queue.forEach(al => {
            al.data = al.data.map(a => ({ name: 'pipeline-job', score: a.calculated.score }));
        });
        return queue;
    }
}

module.exports = PipelineDriversQueueAdapter;
