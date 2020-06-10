
const EventEmitter = require('events');
const stateAdapter = require('../../states/stateAdapter');
const { taskEvents } = require('../../consts');


class AlgorithmExecution extends EventEmitter {
    constructor() {
        super();
        this._registerToEtcdEvents();
    }

    _registerToEtcdEvents() {
        stateAdapter.on(taskEvents.STORING, (task) => {
            this.emit('data-ready', task);
        });
    }

    async setInputToStorage(options) {
        const { storageInput, input } = options;
        return storageInput || input;
    }

    async getResultFromStorage(options) {
        const { result } = options;
        return result;
    }
}

module.exports = new AlgorithmExecution();
