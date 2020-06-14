const log = require('@hkube/logger').GetLogFromContainer();
const { groupBy } = require('../../utils/utils');
const stateManager = require('../store-manager');
const component = require('../../consts/components').DRIVERS_QUEUE;

class StoreAdapter {
    async _getData() {
        return [];
    }

    async setData(data) {
        this._log(data);
        return stateManager.setPipelineDriverRequirements({ name: 'data', data });
    }

    _log(data) {
        const group = groupBy(data, 'name');
        const text = Object.entries(group).map(([k, v]) => `${v} ${k}`).sort().join(', ');
        if (text && text !== this._state) {
            log.debug(`allocated queue: ${text}`, { component });
            this._state = text;
        }
    }
}

module.exports = StoreAdapter;
