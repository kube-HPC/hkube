const log = require('@hkube/logger').GetLogFromContainer();
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
        const text = data.map(q => `${q.data.pods} ${q.name}`).sort().join(', ');
        if (text && text !== this._state) {
            log.debug(`allocated queue: ${text}`, { component });
            this._state = text;
        }
    }
}

module.exports = StoreAdapter;
