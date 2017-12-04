const objectPath = require('object-path');
const clone = require('clone');

const CONSTS = {
    BATCH: '#',
    REF: '@',
    BATCHREF: '#@',
    WAITANY: '*',
    FLOWINPUT: 'flowInput'
}

class InputParser {

    parse(options, input, nodesInput) {
        const batch = this.parseBatchInput(options, input, nodesInput);
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
        const result = this.isNode(input);
        if (result.isNode) {
            nodes.push(result.node);
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
        return typeof input === 'string' && input.startsWith(CONSTS.WAITANY);
    }

    isWaitAnyBatch(input) {
        return (typeof input === 'string') && input.startsWith('*#');
    }

    isWaitAnyNode(input) {
        return typeof input === 'string' && input.startsWith('*@');
    }

    isBatch(input) {
        return typeof input === 'string' && input.startsWith(CONSTS.BATCH);
    }

    isNode(input) {
        const result = {
            isNode: false
        };
        if (this.isReference(input)) {
            const path = this.extractObjectFromInput(input);
            const obj = this.constructObject(path);
            result.node = obj.object;
            result.isNode = result.node !== CONSTS.FLOWINPUT;
        }
        return result;
    }

    _isObjRef(input) {
        return typeof input === 'string' && input.startsWith(CONSTS.REF);
    }

    _isBatchRef(input) {
        return typeof input === 'string' && input.startsWith(CONSTS.BATCHREF);
    }

    isFlowInput(input) {
        if (this._isObjRef(input)) {
            const nodeName = input.substr(1);
            const result = this.constructObject(nodeName);
            return result.object === CONSTS.FLOWINPUT;
        }
    }

    isReference(input) {
        return this._isObjRef(input) || this._isBatchRef(input);
    }

    waitAnyInputIndex(input) {
        return input.findIndex(i => this.isWaitAny(i));
    }

    batchInputIndex(input) {
        return input.findIndex(i => i === i)
    }

    parseBatchInput(object, input, nodesInput) {
        let results = null;
        let path = [];
        let newInput = [];
        input.forEach((inp, ind) => {
            let result = this._findBatch(object, inp, nodesInput, path);
            if (Array.isArray(result)) {
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

    _findBatch(object, input, nodesInput, path) {
        let result = null;
        if (this.isBatch(input)) {
            result = this._tryGetPath(object, input, null, nodesInput);
        }
        else if (this._isObject(input)) {
            result = this._recursivelyObjectFindBatchKey(object, input, nodesInput, path);
        }
        else if (Array.isArray(input)) {
            result = this._recursivelyArrayFindBatchKey(object, input, nodesInput, path);
        }
        return result;
    }

    waitAnyBatchInputIndex(input) {
        return input.findIndex(i => this.isWaitAnyBatch(i));
    }

    nodeInputIndex(input) {
        return input.findIndex(i => this.isNode(i).isNode)
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

    _recursivelyArrayFindBatchKey(object, input, nodesInput, path) {
        let result = null;
        input.forEach((inp, ind) => {
            path.push(ind);
            if (this.isBatch(inp)) {
                result = this._tryGetPath(object, inp, null, nodesInput);
            }
            else if (Array.isArray(inp)) {
                result = this._recursivelyArrayFindBatchKey(object, inp, nodesInput, path);
            }
            else if (this._isObject(inp)) {
                result = this._recursivelyObjectFindBatchKey(object, inp, nodesInput, path);
            }
            else {
                path.pop();
            }
        })
        return result;
    }

    _recursivelyObjectFindBatchKey(object, input, nodesInput, path) {
        let result = null;
        Object.entries(input).forEach(([key, val]) => {
            path.push(key);
            if (this.isBatch(val)) {
                result = this._tryGetPath(object, val, null, nodesInput);
            }
            else if (Array.isArray(val)) {
                result = this._recursivelyArrayFindBatchKey(object, val, nodesInput, path);
            }
            else if (this._isObject(val)) {
                result = this._recursivelyObjectFindBatchKey(object, val, nodesInput, path);
            }
            else {
                path.pop();
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
            const result = this.isNode(a);
            if (result.isNode) {
                nodes.push(result.node);
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
            const result = this.isNode(val);
            if (result.isNode) {
                nodes.push(result.node);
            }
            else if (Array.isArray(val)) {
                this._recursivelyFindNodeInArray(val, nodes);
            }
            else if (this._isObject(val)) {
                this._recursivelyFindNodeInObject(val, nodes);
            }
        })
    }

    _tryGetPath(object, path, options, nodesInput) {
        options = options || {};
        nodesInput = nodesInput || {};
        let result = path;
        if (this.isReference(path)) {
            const obj = this.extractObjectFromInput(path);
            const construct = this.constructObject(obj);
            let ni = object[construct.object] || nodesInput[construct.object];

            if (construct.object === CONSTS.FLOWINPUT && options.parseNode) {
                return null;
            }

            if (ni) {
                if (construct.object === CONSTS.FLOWINPUT) {
                    ni = objectPath.get(object, obj);
                    if (options.checkFlow) {
                        if (ni == null) {
                            throw new Error(`unable to find ${obj}`);
                        }
                    }
                    else {
                        result = ni;
                    }
                }
                else {
                    const array = [];
                    ni.forEach(inp => {
                        if (Array.isArray(inp)) {
                            array.push(inp);
                        }
                        else {
                            array.push(objectPath.get(inp, construct.path));
                        }
                    });
                    result = array;
                }
            }
        }
        return result;
    }
}

module.exports = new InputParser();