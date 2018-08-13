const log = require('@hkube/logger').GetLogFromContainer();
const { groupBy } = require('../../utils/utils');
const stateManager = require('../../store/store-manager');
const component = require('../../consts/components').ALGORITHM_QUEUE;

class StoreAdapter {
    async setData(data) {
        this._log(data);
        await stateManager.setAlgorithmsResourceRequirements({ name: 'data', data });
        // const result = await stateManager.getAlgorithmsResourceRequirements({ name: 'data' });
        return null;
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
