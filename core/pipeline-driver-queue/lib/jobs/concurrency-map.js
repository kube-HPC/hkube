class ConcurrencyMap {
    constructor() {
        this._map = new Map();
    }

    async add(name, count, max) {
        this._map.set(name, { count, max });
    }
}

module.exports = new ConcurrencyMap();
