
const utils = require('../utils/utils');

class ResourceCounter {
    constructor(options) {
        this._map = Object.create(null);
    }

    inc(alg) {
        if (!this._map[alg]) {
            this._map[alg] = 0;
        }
        this._map[alg]++;
    }

    toArray() {
        return utils.mapToArray(this._map, ['alg', 'data']);
    }
}

module.exports = ResourceCounter;