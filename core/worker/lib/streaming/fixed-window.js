class FixedWindow {
    constructor(maxSize) {
        this._array = [];
        this._maxSize = maxSize;
    }

    add(data) {
        if (this._array.length === this._maxSize) {
            this._array.shift();
        }
        this._array.push(data);
    }

    addRange(array) {
        this._array.push(...array);
        this._array = this._array.slice(-this._maxSize);
    }

    get items() {
        return this._array;
    }
}

module.exports = FixedWindow;
