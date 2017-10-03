const objectPath = require('object-path');

class InputParser {

    constructor() {
    }

    parseValue(object, input) {
        if (typeof input == null) {
            return null;
        }
        else if (!this._isObject(object) && !Array.isArray(object)) {
            return object;
        }
        else if (typeof input === 'string') {
            input = this._tryGetPath(object, input);
        }
        else if (this._isObject(input)) {
            this._recursivelyObject(object, input);
        }
        else if (Array.isArray(input)) {
            this._recursivelyArray(object, input);
        }
        return input;
    }

    extractObject(input) {
        const array = input.split('.');
        const object = array.shift();
        const path = array.join('.');
        return { object, path };
    }

    _isObject(object) {
        return Object.prototype.toString.call(object) === '[object Object]';
    }

    _recursivelyArray(object, input) {
        input.forEach((a, i) => {
            if (Array.isArray(a)) {
                this._recursivelyArray(object, a);
            }
            else if (this._isObject(a)) {
                this._recursivelyObject(object, a);
            }
            else {
                array[i] = this._tryGetPath(object, a);
            }
        })
    }

    _tryGetPath(object, path) {
        let result = path;
        if (typeof path === 'string') {
            result = objectPath.get(object, path, path);
        }
        return result;
    }

    _recursivelyObject(object, input) {
        Object.entries(input).forEach(([key, val]) => {
            if (Array.isArray(val)) {
                this._recursivelyArray(object, val);
            }
            else if (this._isObject(val)) {
                this._recursivelyObject(object, val);
            }
            else if (typeof input[key] !== 'object') {
                input[key] = this._tryGetPath(input, val);
            }
        })
    }
}

module.exports = new InputParser();