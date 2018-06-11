const Adapter = require('../Adapter');
const stateManager = require('../../state/state-manager');
const log = require('@hkube/logger').GetLogFromContainer();
const component = require('../../../common/consts/componentNames').RUNNER;

class StoreAdapter extends Adapter {
    constructor(options, name) {
        super(options, name);
    }

    async getData() {
        return null;
    }

    async setData(data) {
        this._text(data);
        return stateManager.setAlgorithmsResourceRequirements(data);
    }


    _text(queue) {
        const text = queue.map(q => `${q.data.pods} ${q.name}`).sort().join(', ');
        if (text !== this._state) {
            log.debug(`allocate queue: ${text}`, { component });
            this._state = text;
        }
    }
}

module.exports = StoreAdapter;
