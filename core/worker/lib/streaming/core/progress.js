const EventEmitter = require('events');
const isEqual = require('lodash.isequal');
const cloneDeep = require('lodash.clonedeep');
const { streamingEvents } = require('../../consts');

class Progress extends EventEmitter {
    constructor() {
        super();
        this._currentProgress = Object.create(null);
        this._lastProgress = Object.create(null);
    }

    update(nodeName, data) {
        this._currentProgress[nodeName] = data;
    }

    check() {
        if (!isEqual(this._currentProgress, this._lastProgress)) {
            this.emit(streamingEvents.PROGRESS_CHANGED, this._currentProgress);
            this._lastProgress = cloneDeep(this._currentProgress);
            return this._currentProgress;
        }
        return null;
    }
}

module.exports = Progress;
