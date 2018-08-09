const log = require('@hkube/logger').GetLogFromContainer();
const Adapter = require('../Adapter');
const stateManager = require('../../state/state-manager');
const component = require('../../consts/components').DRIVERS_QUEUE;

class StoreAdapter extends Adapter {
    constructor(options) {
        super(options);
    }

    async _getData() {
        return [];
    }

    async setData(data) {
        this._log(data);
        return stateManager.setPipelineDriverRequirements(data);
    }

    _log(queue) {
        const text = queue.map(q => `${q.data.pods} ${q.name}`).sort().join(', ');
        if (text && text !== this._state) {
            log.debug(`allocated queue: ${text}`, { component });
            this._state = text;
        }
    }
}

module.exports = StoreAdapter;
