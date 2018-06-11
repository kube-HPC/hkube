
class ResourceCounter {
    constructor() {
        this._map = Object.create(null);
    }

    inc(algorithm) {
        if (!this._map[algorithm]) {
            this._map[algorithm] = 0;
        }
        this._map[algorithm] += 1;
    }

    results() {
        return this._map;
    }
}

module.exports = ResourceCounter;
