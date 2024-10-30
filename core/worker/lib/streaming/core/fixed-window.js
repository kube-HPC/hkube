/**
 * Fixed window is just an array with fixed configurable size.
 * It used to holds some of the streaming statistics data
 * that need to be examined in a limited window.
 */
class FixedWindow {
    constructor(maxSize) {
        this._array = [];
        this._maxSize = maxSize;
        this._minSizeForMaxSize = maxSize;
    }

    add(data) {
        if (this._array.length === this._maxSize) {
            this._array.shift();
        }
        this._array.push(data);
    }

    addRange(array) {
        if (array.length) {
            this._array.push(...array);
            this._array = this._array.slice(-this._maxSize);
        }
    }

    setMaxSize(maxSize) {
        if (maxSize) {
            this._maxSize = Math.max(this._minSizeForMaxSize, maxSize);
        }
    }

    get items() {
        return this._array;
    }
}

module.exports = FixedWindow;
