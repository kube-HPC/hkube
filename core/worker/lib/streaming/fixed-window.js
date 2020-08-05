class FixedWindow extends Array {
    constructor(maxSize) {
        super();
        this._maxSize = maxSize;
    }

    add(data) {
        if (this.length === this._maxSize) {
            this.shift();
        }
        this.push(data);
    }
}

module.exports = FixedWindow;
