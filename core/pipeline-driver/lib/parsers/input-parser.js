const objectPath = require('object-path');

class InputParser {

    constructor() {
        this._etcd = null;
    }

    parseValue(data, input) {
        if (typeof input == null) {
            return null;
        }
        else if (typeof input === 'string') {
            input = objectPath.get(data, input);
        }
        else if (typeof input === 'object' && !Array.isArray(input)) {
            this._recursivelyObject(data, input);
        }
        else if (Array.isArray(input)) {
            this._recursivelyArray(data, input);
        }
        return input;
    }

    _recursivelyArray(data, array) {
        array.forEach((a, i) => {
            if (Array.isArray(a)) {
                this._recursivelyArray(data, a);
            }
            else if (typeof a === 'object' && !Array.isArray(a)) {
                this._recursivelyObject(data, a);
            }
            else if (typeof array[a] !== 'object') {
                array[i] = objectPath.get(data, a);
            }
        })
    }

    _recursivelyObject(data, object) {
        Object.entries(object).forEach(([key, val]) => {
            if (Array.isArray(val)) {
                this._recursivelyArray(data, val);
            }
            else if (typeof val === 'object' && !Array.isArray(val)) {
                this._recursivelyObject(data, val);
            }
            else if (typeof object[key] !== 'object') {
                object[key] = objectPath.get(data, val);
            }
        })
    }
}

module.exports = new InputParser();