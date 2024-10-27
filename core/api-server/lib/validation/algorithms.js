const converter = require('@hkube/units-converter');
const { nodeKind } = require('@hkube/consts');
const stateManager = require('../state/state-manager');
const regex = require('../consts/regex');
const { ResourceNotFoundError, InvalidDataError } = require('../errors');
const LabelValueMaxLength = 63;
const DNS1123SubdomainMaxLength = 253;

class ApiValidator {
    constructor(validator) {
        this._validator = validator;
    }

    addAlgorithmDefaults(algorithm) {
        this._validator.addDefaults(this._validator.definitions.algorithm, algorithm);
    }

    validateAlgorithmName(algorithm) {
        this._validator.validate(this._validator.definitions.algorithmNameObject, algorithm);
    }

    validateUpdateAlgorithm(algorithm) {
        this._validator.validate(this._validator.definitions.algorithm, algorithm, true);
        this._validateAlgorithmEnvVar(algorithm);
    }

    validateApplyAlgorithm(algorithm) {
        this._validator.validate(this._validator.definitions.algorithm, algorithm, false);
        this._validateAlgorithmEnvVar(algorithm);
    }

    validateAlgorithmVersion(algorithm) {
        this._validator.validate(this._validator.definitions.applyAlgorithmVersion, algorithm, false);
    }

    validateAlgorithmTag(algorithm) {
        this._validator.validate(this._validator.definitions.algorithmVersionTag, algorithm, false);
    }

    validateAlgorithmDelete(algorithm) {
        this._validator.validate(this._validator.definitions.algorithmDelete, algorithm, true);
    }

    // This method checks if the given algorithm can run on a node with sufficient resources.
    // Note: The availability of free resources is not guaranteed.
    async validateAlgorithmResources(algorithm) {
        const resources = await stateManager.getSystemResources();
        if (resources && resources[0] && resources[0].nodes) {
            const { cpu, gpu } = algorithm;
            const mem = converter.getMemoryInMi(algorithm.mem);
            const nodes = resources[0].nodes.map(n => this._findNodeForSchedule(n, { cpu, mem, gpu }));
            const node = nodes.find(n => n.available);
            if (!node) {
                const error = this._createAlgorithmResourcesError(nodes);
                throw new InvalidDataError(error);
            }
        }
    }

    _createAlgorithmResourcesError(nodes) {
        const maxCapacityMap = Object.create(null);
        let nodeNumber = 0;
        nodes.forEach(n => {
            const nodeTotal = n.node.total;
            Object.entries(n.details)
                .filter(([, v]) => v === false)
                .forEach(([k]) => {
                    if (!maxCapacityMap[k]) {
                        maxCapacityMap[k] = Object.create(null);
                    }
                    maxCapacityMap[k][nodeNumber] = nodeTotal[k];
                });
            nodeNumber += 1;
        });
        const maxCapacity = Object.entries(maxCapacityMap).map(([resourceType, nodeData]) => {
            const nodeDetails = Object.entries(nodeData)
                .map(([nodeIndex, capacity]) => `node${+nodeIndex + 1}: ${capacity}`)
                .join(', ');
            return `${resourceType}(${nodeDetails})`;
        });
        const error = `maximum capacity exceeded ${maxCapacity.join(', ')}`;
        return error;
    }

    _findNodeForSchedule(node, { cpu, mem, gpu = 0 }) {
        const cpuAvailable = cpu <= node.total.cpu;
        const memAvailable = mem <= node.total.mem;
        const gpuAvailable = gpu <= node.total.gpu;

        return {
            node,
            available: cpuAvailable && memAvailable && gpuAvailable,
            details: { cpu: cpuAvailable, mem: memAvailable, gpu: gpuAvailable }
        };
    }

    async validateAlgorithmExists(pipeline) {
        const pipelineAlgorithms = pipeline.nodes
            .filter(n => n.algorithmName && (n.kind === nodeKind.Algorithm || n.kind === nodeKind.Debug))
            .map(p => p.algorithmName);
        const algorithmsMap = await stateManager.getAlgorithmsMapByNames({ names: pipelineAlgorithms });
        pipelineAlgorithms.forEach((a) => {
            const algorithm = algorithmsMap.get(a);
            if (!algorithm) {
                throw new ResourceNotFoundError('algorithm', a);
            }
            if (!algorithm.algorithmImage) {
                throw new InvalidDataError(`missing image for algorithm ${a}`);
            }
        });
        return algorithmsMap;
    }

    _validateAlgorithmEnvVar(algorithm) {
        this._validateEnvVar(algorithm.algorithmEnv);
        this._validateEnvVar(algorithm.workerEnv);
        this._validateKeyValue(algorithm.labels, 'labels');
        this._validateKeyValue(algorithm.annotations, 'annotations');
    }

    _validateEnvVar(env) {
        if (!env) {
            return;
        }
        Object.entries(env).forEach(([k, v]) => {
            if (typeof k !== 'string') {
                throw new InvalidDataError(`${k} must be a string`);
            }
            else if (this._isObject(v)) {
                const key = Object.keys(v)[0];
                this._validator.validate(this._validator.definitions.kubernetesValueFrom, key);
            }
        });
    }

    _validateKeyValue(keyVal, field) {
        if (!keyVal) {
            return;
        }
        Object.entries(keyVal).forEach(([k, v]) => {
            this._validateKeySpec(k, field);
            this._validateValueSpec(v, field);
        });
    }

    _validateValueSpec(value, field) {
        const type = 'value';
        if (!this._isString(value)) {
            throw new InvalidDataError(`${field} ${type} must be a valid string`);
        }
        if (this._isEmptyString(value)) {
            return;
        }
        if (value.length > LabelValueMaxLength) {
            throw new InvalidDataError(`${field} ${type} must be ${LabelValueMaxLength} characters or less`);
        }
        if (!regex.LABEL_KEY_VALUE_REGEX.test(value)) {
            throw new InvalidDataError(`${field} ${type} must beginning and ending with an alphanumeric character with dashes (-), underscores (_), dots (.), and alphanumerics betweens`);
        }
    }

    _validateKeySpec(value, field) {
        const type = 'key';
        if (!this._isValidString(value)) {
            throw new InvalidDataError(`${field} ${type} must be a valid string`);
        }
        let key = value;
        const [prefix, name] = value.split('/');
        if (value.includes('/')) {
            key = name;
            if (prefix > DNS1123SubdomainMaxLength) {
                throw new InvalidDataError(`${field} ${type} prefix be ${DNS1123SubdomainMaxLength} characters or less`);
            }
            if (!regex.RFC_DNS_1123.test(prefix)) {
                throw new InvalidDataError(`${field} ${type} prefix must be a lowercase RFC 1123 subdomain and must consist of lower case alphanumeric characters, '-' or '.', and must start and end with an alphanumeric character`);
            }
        }
        if (!this._isValidString(key)) {
            throw new InvalidDataError(`${field} ${type} name must be a valid string`);
        }
        if (key.length > LabelValueMaxLength) {
            throw new InvalidDataError(`${field} ${type} name must be ${LabelValueMaxLength} characters or less`);
        }
        if (!regex.LABEL_KEY_VALUE_REGEX.test(key)) {
            throw new InvalidDataError(`${field} ${type} name must beginning and ending with an alphanumeric character with dashes (-), underscores (_), dots (.), and alphanumerics betweens`);
        }
    }

    _isString(str) {
        return typeof str === 'string';
    }

    _isEmptyString(str) {
        return str.length === 0;
    }

    _isValidString(str) {
        return this._isString(str) && !this._isEmptyString(str);
    }

    _isObject(object) {
        return Object.prototype.toString.call(object) === '[object Object]';
    }
}

module.exports = ApiValidator;
