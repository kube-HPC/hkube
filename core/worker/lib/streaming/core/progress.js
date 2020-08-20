class Progress {
    constructor() {
        this._progress = Object.create(null);
    }

    update(nodeName, data) {
        this._progress[nodeName] = data;
    }

    get data() {
        return this._progress;
    }
}

module.exports = Progress;
