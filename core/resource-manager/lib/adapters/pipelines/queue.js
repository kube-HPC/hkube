const Adapter = require('./../Adapter');
// const stateManager = require('../../state/state-manager');

class PipelineDriversAdapter extends Adapter {
    constructor(options, name) {
        super(options, name);
    }

    async getData() {
        // const queue = await stateManager.getPipelineDriverQueue();
        // return queue;
        return [];
    }
}

module.exports = PipelineDriversAdapter;
