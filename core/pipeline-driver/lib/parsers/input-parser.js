const objectPath = require('object-path');

class InputParser {

    constructor() {
    }

    parseValue(object, input, chechFlowInput, checkNodeInput) {
        if (typeof input == null) {
            return null;
        }
        else if (!this._isObject(object) && !Array.isArray(object)) {
            return object;
        }
        else if (typeof input === 'string') {
            input = this._tryGetPath(object, input, chechFlowInput, checkNodeInput);
        }
        else if (this._isObject(input)) {
            this._recursivelyObject(object, input, chechFlowInput, checkNodeInput);
        }
        else if (Array.isArray(input)) {
            this._recursivelyArray(object, input, chechFlowInput, checkNodeInput);
        }
        return input;
    }

    checkFlowInput(object, input) {
        return this.parseValue(object, input, true, false);
    }

    parseFlowInput(object, input) {
        return this.parseValue(object, input, false, false);
    }

    parseNodeInput(object, input) {
        return this.parseValue(object, input, false, true);
    }

    extractNodesFromInput(input) {
        let nodes = [];
        if (this.isNode(input)) {
            const nodeName = input.substr(1);
            const result = this.extractObject(nodeName);
            nodes.push(result.object);
        }
        else if (this._isObject(input)) {
            this._recursivelyFindNodeInObject(input, nodes);
        }
        else if (Array.isArray(input)) {
            this._recursivelyFindNodeInArray(input, nodes);
        }
        return Array.from(new Set(nodes));
    }

    extractObjectFromInput(input) {
        let nodeName;
        if (this._isObjRef(input)) {
            nodeName = input.substr(1);
        }
        if (this._isBatchRef(input)) {
            nodeName = input.substr(2);
        }
        else if (this.isWaitAny(input)) {
            nodeName = input.substr(2);
        }
        return nodeName;
    }

    isWaitAny(input) {
        return typeof input === 'string' && input.startsWith('*');
    }

    isWaitAnyBatch(input) {
        return (typeof input === 'string') && input.startsWith('*#');
    }

    isWaitAnyNode(input) {
        return typeof input === 'string' && input.startsWith('*@');
    }

    isBatch(input) {
        return typeof input === 'string' && input.startsWith('#');
    }

    isNode(input) {
        if (this._isObjRef(input)) {
            const nodeName = input.substr(1);
            const result = this.extractObject(nodeName);
            return result.object !== 'flowInput';
        }
    }

    _isObjRef(input) {
        return typeof input === 'string' && input.startsWith('@');
    }

    _isBatchRef(input) {
        return typeof input === 'string' && input.startsWith('#@');
    }

    isFlowInput(input) {
        if (this._isObjRef(input)) {
            const nodeName = input.substr(1);
            const result = this.extractObject(nodeName);
            return result.object === 'flowInput';
        }
    }

    isReffernce(input) {
        return this._isObjRef(input) || this._isBatchRef(input);
    }

    waitAnyInputIndex(input) {
        return input.findIndex(i => this.isWaitAny(i));
    }

    batchInputIndex(input) {
        return input.findIndex(i => this._findBatchKey(i));
    }

    _findBatchKey(object) {
        let found = false;
        if (this.isBatch(object)) {
            found = true;
        }
        else if (this._isObject(object)) {
            found = this._recursivelyObjectFindBatchKey(object);
        }
        else if (Array.isArray(object)) {
            found = this._recursivelyArrayFindBatchKey(object);
        }
        return found;
    }

    waitAnyBatchInputIndex(input) {
        return input.findIndex(i => this.isWaitAnyBatch(i));
    }

    nodeInputIndex(input) {
        return input.findIndex(i => this.isNode(i))
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

    _recursivelyArrayFindBatchKey(array) {
        let found = false;
        array.forEach((a, i) => {
            if (this.isBatch(a)) {
                found = true;
            }
            else if (Array.isArray(a)) {
                found = this._recursivelyArrayFindBatchKey(array);
            }
            else if (this._isObject(a)) {
                found = this._recursivelyObjectFindBatchKey(array);
            }
        })
        return found;
    }

    _recursivelyObjectFindBatchKey(object) {
        let found = false;
        Object.entries(object).forEach(([key, val]) => {
            if (this.isBatch(val)) {
                found = true;
            }
            else if (Array.isArray(val)) {
                found = this._recursivelyArrayFindBatchKey(object);
            }
            else if (this._isObject(val)) {
                found = this._recursivelyObjectFindBatchKey(object);
            }
        })
        return found;
    }

    _recursivelyArray(object, input, chechFlowInput, checkNodeInput) {
        input.forEach((a, i) => {
            if (Array.isArray(a)) {
                this._recursivelyArray(object, a, chechFlowInput, checkNodeInput);
            }
            else if (this._isObject(a)) {
                this._recursivelyObject(object, a, chechFlowInput, checkNodeInput);
            }
            else {
                input[i] = this._tryGetPath(object, a, chechFlowInput, checkNodeInput);
            }
        })
    }

    _recursivelyObject(object, input, chechFlowInput, checkNodeInput) {
        Object.entries(input).forEach(([key, val]) => {
            if (Array.isArray(val)) {
                this._recursivelyArray(object);
            }
            else if (this._isObject(val)) {
                this._recursivelyObject(object, val, chechFlowInput, checkNodeInput);
            }
            else if (typeof input[key] !== 'object') {
                input[key] = this._tryGetPath(object, val, chechFlowInput, checkNodeInput);
            }
        })
    }

    _recursivelyFindNodeInArray(input, nodes) {
        input.forEach((a, i) => {
            if (this.isNode(a)) {
                const nodeName = a.substr(1);
                const result = this.extractObject(nodeName);
                nodes.push(result.object);
            }
            if (Array.isArray(a)) {
                this._recursivelyFindNodeInArray(a, nodes);
            }
            else if (this._isObject(a)) {
                this._recursivelyFindNodeInObject(a, nodes);
            }
        })
    }

    _recursivelyFindNodeInObject(input, nodes) {
        Object.entries(input).forEach(([key, val]) => {
            if (this.isNode(val)) {
                const nodeName = val.substr(1);
                const result = this.extractObject(nodeName);
                nodes.push(result.object);
            }
            else if (Array.isArray(val)) {
                this._recursivelyFindNodeInArray(val, nodes);
            }
            else if (this._isObject(val)) {
                this._recursivelyFindNodeInObject(val, nodes);
            }
        })
    }

    _tryGetPath(object, path, chechFlowInput, checkNodeInput) {
        let result = path;
        if (this.isReffernce(path)) {
            path = this.extractObjectFromInput(path);

            const res = this.extractObject(path);
            if (res.object === 'flowInput') {
                let val = objectPath.get(object, path);
                if (chechFlowInput) {
                    if (val == null) {
                        throw new Error(`unable to find ${path}`);
                    }
                }
                else {
                    result = val;
                }
            }

            else if (checkNodeInput) {
                const res = this.extractObject(path);
                result = objectPath.get(object, res.path);
            }
            else {
                result = objectPath.get(object, path);
            }
        }
        return result;
    }
}

module.exports = new InputParser();