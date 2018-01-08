const objectPath = require('object-path');
const clone = require('clone');

const CONSTS = {
    REF: '@',
    BATCH: '#',
    WAIT_BATCH: '*@',
    RAW_BATCH: '#[',
    FLOW_INPUT: 'flowInput'
}

class InputParser {

    parse(options, input, parentOutput, index) {
        const newInput = clone(input);
        const batch = this.parseBatchInput(options, newInput, parentOutput);
        const isBatch = batch.length > 0;
        const inputObj = isBatch ? batch : newInput;

        inputObj.forEach((ni, ind) => {
            inputObj[ind] = this.parseFlowInput(options, ni);
            if (parentOutput) {
                let res = this.parseParentNodeOutput(parentOutput, ni, index);
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

    parseValue(object, input, options, index) {
        if (typeof input == null) {
            return null;
        }
        else if (!this._isObject(object) && !Array.isArray(object)) {
            return object;
        }
        else if (typeof input === 'string') {
            input = this._extractValueFromInput(object, input, options, null, index);
        }
        else if (this._isObject(input)) {
            this._recursivelyObject(object, input, options, index);
        }
        else if (Array.isArray(input)) {
            this._recursivelyArray(object, input, options, index);
        }
        return input;
    }

    parseFlowInput(object, input) {
        return this.parseValue(object, input, { parseFlow: true });
    }

    parseParentNodeOutput(parentOutput, input, index) {
        return this.parseValue(parentOutput, input, { parseParentNode: true }, index);
    }

    extractNodesFromInput(input) {
        const results = [];
        const result = this._isNode(input);
        if (result.isNode) {
            results.push(result);
        }
        else if (this._isObject(input)) {
            this._recursivelyFindNodeInObject(input, results);
        }
        else if (Array.isArray(input)) {
            this._recursivelyFindNodeInArray(input, results);
        }
        return results.filter(r => r.isNode);
    }

    extractObjectFromInput(input) {
        let object;
        if (this._isObjRef(input)) {
            object = input.substr(1);
        }
        if (this._isBatch(input)) {
            object = input.substr(2);
        }
        else if (this._isWaitBatch(input)) {
            object = input.substr(2);
        }
        return object;
    }

    _isNode(input) {
        const result = {
            isNode: false
        };
        if (this._isReference(input)) {
            const path = this.extractObjectFromInput(input);
            const obj = this.constructObject(path);
            const isFlowInput = obj.object === CONSTS.FLOW_INPUT;
            result.nodeName = obj.object;
            result.isNode = !isFlowInput;
            result.isWaitBatch = this._isBatch(input);
            result.isWaitAnyBatch = this._isWaitBatch(input);
            result.isWaitNode = !isFlowInput && !result.isWaitBatch && !result.isWaitAnyBatch;
        }
        return result;
    }

    _isBatch(input) {
        return typeof input === 'string' && input.startsWith(CONSTS.BATCH);
    }

    _isBatchRaw(input) {
        return typeof input === 'string' && input.startsWith(CONSTS.RAW_BATCH);
    }

    _isObjRef(input) {
        return typeof input === 'string' && input.startsWith(CONSTS.REF);
    }

    _isWaitBatch(input) {
        return typeof input === 'string' && input.startsWith(CONSTS.WAIT_BATCH);
    }

    isFlowInput(input) {
        if (this._isObjRef(input)) {
            const nodeName = input.substr(1);
            const result = this.constructObject(nodeName);
            return result.object === CONSTS.FLOW_INPUT;
        }
    }

    _isReference(input) {
        return this._isObjRef(input) || this._isBatch(input) || this._isWaitBatch(input);
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
        if (this._isBatch(input)) {
            result = this._extractValueFromInput(object, input, null, nodesInput);
        }
        else if (this._isObject(input)) {
            result = this._recursivelyObjectFindBatchKey(object, input, nodesInput, path);
        }
        else if (Array.isArray(input)) {
            result = this._recursivelyArrayFindBatchKey(object, input, nodesInput, path);
        }
        return result;
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
            if (this._isBatch(inp)) {
                result = this._extractValueFromInput(object, inp, null, nodesInput);
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
            if (this._isBatch(val)) {
                result = this._extractValueFromInput(object, val, null, nodesInput);
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

    _recursivelyArray(object, input, options, index) {
        input.forEach((a, i) => {
            if (Array.isArray(a)) {
                this._recursivelyArray(object, a, options, index);
            }
            else if (this._isObject(a)) {
                this._recursivelyObject(object, a, options, index);
            }
            else {
                input[i] = this._extractValueFromInput(object, a, options, null, index);
            }
        })
    }

    _recursivelyObject(object, input, options, index) {
        Object.entries(input).forEach(([key, val]) => {
            if (Array.isArray(val)) {
                this._recursivelyArray(object, val, options, index);
            }
            else if (this._isObject(val)) {
                this._recursivelyObject(object, val, options, index);
            }
            else if (typeof input[key] !== 'object') {
                input[key] = this._extractValueFromInput(object, val, options, null, index);
            }
        })
    }

    _recursivelyFindNodeInArray(input, nodes) {
        input.forEach((a, i) => {
            const result = this._isNode(a);
            if (result.isNode) {
                nodes.push(result);
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
            const result = this._isNode(val);
            if (result.isNode) {
                nodes.push(result);
            }
            else if (Array.isArray(val)) {
                this._recursivelyFindNodeInArray(val, nodes);
            }
            else if (this._isObject(val)) {
                this._recursivelyFindNodeInObject(val, nodes);
            }
        })
    }

    _extractValueFromInput(object, input, options, nodesInput, index) {
        options = options || {};
        nodesInput = nodesInput || {};
        let result = input;
        if (this._isBatchRaw(input)) {
            const array = input.substr(1);
            result = this._tryParseJSON(array);
        }
        if (this._isReference(input)) {
            let ni = null;
            const obj = this.extractObjectFromInput(input);
            const construct = this.constructObject(obj);

            if (options.parseParentNode) {
                const isWaitBatch = this._isWaitBatch(input);
                const type = isWaitBatch ? 'waitAnyBatch' : 'waitNode';
                index = isWaitBatch ? index : null;
                const parent = object.find(o => o.type === type && o.index == index && o.node === construct.object);
                result = parent.result;
                return result;
            }
            else {
                ni = object[construct.object] || nodesInput[construct.object];
            }
            if (construct.object === CONSTS.FLOW_INPUT && options.parseParentNode) {
                return null;
            }
            if (ni) {
                if (construct.object === CONSTS.FLOW_INPUT) {
                    result = objectPath.get(object, obj);
                }
                else {
                    const array = [];
                    if (Array.isArray(ni)) {
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
                    else {
                        result = objectPath.get(object, obj)
                    }
                }
            }
        }
        return result;
    }

    _tryParseJSON(json) {
        let parsed = json;
        try {
            parsed = JSON.parse(json);
        }
        catch (e) {
        }
        return parsed
    }
}

module.exports = new InputParser();