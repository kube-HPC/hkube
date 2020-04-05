const log = require('@hkube/logger').GetLogFromContainer();
const stateManager = require('../store-manager');
const component = require('../../consts/components').ALGORITHM_QUEUE;

class StoreAdapter {
    async setData(data) {
        this._log(data);
        await Promise.all(data.map(d => stateManager.setAlgorithmsResourceRequirements(d)));
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
