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

    addRange(array) {
        array.forEach(a => this.add(a));
    }
}

module.exports = FixedWindow;
