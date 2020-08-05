const EventEmitter = require('events');
const isEqual = require('lodash.isequal');

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
            this.emit('progress', this._currentProgress);
            this._lastProgress = this._currentProgress;
            return this._currentProgress;
        }
        return null;
    }
}

module.exports = Progress;
