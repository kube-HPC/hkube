const uuidv4 = require('uuid/v4'); // eslint-disable-line

class Task {
    constructor(options) {
        this.taskId = options.taskId || this._createTaskID(options);
        this.entranceTime = options.entranceTime || Date.now();
    }

    _createTaskID(options) {
        return [options.nodeName, options.algorithmName, uuidv4()].join(':');
    }
}

module.exports = Task;
