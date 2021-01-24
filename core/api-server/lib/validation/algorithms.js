const converter = require('@hkube/units-converter');
const { nodeKind } = require('@hkube/consts');
const stateManager = require('../state/state-manager');
const { ResourceNotFoundError, InvalidDataError } = require('../errors');

class ApiValidator {
    constructor(validator) {
        this._validator = validator;
    }

    addAlgorithmDefaults(algorithm) {
        this._validator.addDefaults(this._validator.definitions.algorithm, algorithm);
    }

    validateAlgorithmName(algorithm) {
        this._validator.validate(this._validator.definitionsInternal.algorithmName, algorithm);
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
        this._validator.validate(this._validator.definitionsInternal.algorithmDelete, algorithm, true);
    }

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

        nodes.forEach(n => {
            Object.entries(n.details)
                .filter(([, v]) => v === false)
                .forEach(([k]) => {
                    if (!maxCapacityMap[k]) {
                        maxCapacityMap[k] = 0;
                    }
                    maxCapacityMap[k] += 1;
                });
        });

        const maxCapacity = Object.entries(maxCapacityMap).map(([k, v]) => `${k} (${v} nodes)`);
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
            .filter(n => n.algorithmName && n.kind !== nodeKind.DataSource)
            .map(p => p.algorithmName);
        const algorithmsMap = await stateManager.getAlgorithmsMapByNames({ names: pipelineAlgorithms });
        pipelineAlgorithms.forEach((a) => {
            const algorithm = algorithmsMap.get(a);
            if (!algorithm) {
                throw new ResourceNotFoundError('algorithm', a);
            }
        });
        return algorithmsMap;
    }

    validateAlgorithmImage(algorithms) {
        algorithms.forEach((a) => {
            if (!a.algorithmImage && !a.options?.debug) {
                throw new InvalidDataError(`missing image for algorithm ${a.name}`);
            }
        });
    }

    _validateAlgorithmEnvVar(algorithm) {
        this._validateEnvVar(algorithm.algorithmEnv);
        this._validateEnvVar(algorithm.workerEnv);
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
                this._validator.validate(this._validator.definitionsInternal.kubernetesValueFrom, key);
            }
        });
    }

    _isObject(object) {
        return Object.prototype.toString.call(object) === '[object Object]';
    }
}

module.exports = ApiValidator;
