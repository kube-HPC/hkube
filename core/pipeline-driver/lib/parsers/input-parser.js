const objectPath = require('object-path');
const clone = require('clone');

class InputParser {

    constructor() {
    }

    parse(options, input, nodesInput) {
        const batch = this.parseBatchInput(options, input);
        const isBatch = batch.length > 0;
        const inputObj = isBatch ? batch : input;

        inputObj.forEach((ni, ind) => {
            inputObj[ind] = this.parseFlowInput(options, ni);
            if (nodesInput) {
                let res = this.parseNodeInput(nodesInput, ni);
                if (res) {
                    inputObj[ind] = res;
                }
            }
        })
        return {
            batch: isBatch,
            input: inputObj
        }
    }

    parseValue(object, input, options) {
        if (typeof input == null) {
            return null;
        }
        else if (!this._isObject(object) && !Array.isArray(object)) {
            return object;
        }
        else if (typeof input === 'string') {
            input = this._tryGetPath(object, input, options);
        }
        else if (this._isObject(input)) {
            this._recursivelyObject(object, input, options);
        }
        else if (Array.isArray(input)) {
            this._recursivelyArray(object, input, options);
        }
        return input;
    }

    checkFlowInput(object, input) {
        return this.parseValue(object, input, { checkFlow: true });
    }

    parseFlowInput(object, input) {
        return this.parseValue(object, input, { parseFlow: true });
    }

    parseNodeInput(object, input) {
        return this.parseValue(object, input, { parseNode: true });
    }

    extractNodesFromInput(input) {
        let nodes = [];
        if (this.isNode(input)) {
            const nodeName = input.substr(1);
            const result = this.constructObject(nodeName);
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
            const result = this.constructObject(nodeName);
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
            const result = this.constructObject(nodeName);
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
        return input.findIndex(i => i === i)
    }

    parseBatchInput(object, input, nodeInput) {
        let results = null;
        let path = [];
        let newInput = [];
        input.forEach((inp, ind) => {
            let result = this._findBatchKey(object, inp, path);
            if (result) {
                result.forEach((res, i) => {
                    let tmpInput = clone(input);
                    if (path.length > 0) {
                        objectPath.set(tmpInput[ind], path.join('.'), res);
                    }
                    else {
                        tmpInput[ind] = res
                    }
                    newInput.push(tmpInput);
                });
            }
        });
        return newInput;
    }

    _findBatchKey(object, input, path) {
        let result = null;
        if (this.isBatch(input)) {
            result = this._tryGetPath(object, input);
        }
        else if (this._isObject(input)) {
            result = this._recursivelyObjectFindBatchKey(object, input, path);
        }
        else if (Array.isArray(input)) {
            result = this._recursivelyArrayFindBatchKey(object, input, path);
        }
        return result;
    }

    waitAnyBatchInputIndex(input) {
        return input.findIndex(i => this.isWaitAnyBatch(i));
    }

    nodeInputIndex(input) {
        return input.findIndex(i => this.isNode(i))
    }

    constructObject(input) {
        const array = input.split('.');
        const object = array.shift();
        const path = array.join('.');
        return { object, path };
    }

    _isObject(object) {
        return Object.prototype.toString.call(object) === '[object Object]';
    }

    _recursivelyArrayFindBatchKey(object, input, path) {
        let result = null;
        input.forEach((inp, ind) => {
            path.push(ind);
            if (this.isBatch(inp)) {
                result = this._tryGetPath(object, inp);
            }
            else if (Array.isArray(inp)) {
                result = this._recursivelyArrayFindBatchKey(object, inp, path);
            }
            else if (this._isObject(inp)) {
                result = this._recursivelyObjectFindBatchKey(object, inp, path);
            }
        })
        return result;
    }

    _recursivelyObjectFindBatchKey(object, input, path) {
        let result = null;
        Object.entries(input).forEach(([key, val]) => {
            path.push(key);
            if (this.isBatch(val)) {
                result = this._tryGetPath(object, val);
            }
            else if (Array.isArray(val)) {
                result = this._recursivelyArrayFindBatchKey(object, val, path);
            }
            else if (this._isObject(val)) {
                result = this._recursivelyObjectFindBatchKey(object, val, path);
            }
        })
        return result;
    }

    _recursivelyArray(object, input, options) {
        input.forEach((a, i) => {
            if (Array.isArray(a)) {
                this._recursivelyArray(object, a, options);
            }
            else if (this._isObject(a)) {
                this._recursivelyObject(object, a, options);
            }
            else {
                input[i] = this._tryGetPath(object, a, options);
            }
        })
    }

    _recursivelyObject(object, input, options) {
        Object.entries(input).forEach(([key, val]) => {
            if (Array.isArray(val)) {
                this._recursivelyArray(object, val, options);
            }
            else if (this._isObject(val)) {
                this._recursivelyObject(object, val, options);
            }
            else if (typeof input[key] !== 'object') {
                input[key] = this._tryGetPath(object, val, options);
            }
        })
    }

    _recursivelyFindNodeInArray(input, nodes) {
        input.forEach((a, i) => {
            if (this.isNode(a)) {
                const nodeName = a.substr(1);
                const result = this.constructObject(nodeName);
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
                const result = this.constructObject(nodeName);
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

    _tryGetPath(object, path, options) {
        options = options || {};
        let result = path;
        if (this.isReffernce(path)) {
            const obj = this.extractObjectFromInput(path);
            const construct = this.constructObject(obj);
            if (options.checkFlow || options.parseFlow) {
                if (construct.object === 'flowInput') {
                    const val = objectPath.get(object, obj);
                    if (options.checkFlow) {
                        if (val == null) {
                            throw new Error(`unable to find ${obj}`);
                        }
                    }
                    else {
                        result = val;
                    }
                }
            }
            else if (options.parseNode) {
                if (construct.object === 'flowInput') {
                    return null;
                }
                const array = [];
                const ni = object[construct.object];
                if (ni) {
                    ni.forEach(i => {
                        array.push(objectPath.get(i, construct.path));
                    });
                    result = array;
                }
                else {
                    result = array;
                }
            }
            else {
                result = objectPath.get(object, obj);
            }
        }
        return result;
    }
}

module.exports = new InputParser();