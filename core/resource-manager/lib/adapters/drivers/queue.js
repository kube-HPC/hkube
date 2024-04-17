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
            // eslint-disable-next-line array-callback-return, consistent-return
            al.data = al.data.map((a, index) => {
                if ((al.maxExceeded) && (!al.maxExceeded[index])) { // concurrent algorithms that can't run won't spam queue
                    return { name: al.name, score: a };
                }
            });
        });
        const combined = [{ name: combinedQueue, data: [] }];
        queue.forEach(al => {
            combined[0].data = combined[0].data.concat(al.data.map(a => ({ ...a, name: combinedQueue })));
        });
        return combined;
    }
}

module.exports = PipelineDriversQueueAdapter;
