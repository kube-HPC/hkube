const Validator = require('ajv');
const converter = require('@hkube/units-converter');
const { CronJob } = require('cron');
const { Graph, alg } = require('graphlib');
const { parser } = require('@hkube/parsers');
const regex = require('../../lib/consts/regex');
const stateManager = require('../state/state-manager');
const { ResourceNotFoundError, InvalidDataError } = require('../errors');

const validator = new Validator({ useDefaults: false, coerceTypes: true });
const defaulter = new Validator({ useDefaults: true, coerceTypes: true });
const MIN_MEMORY = 4;

class ApiValidator {
    init(schemas, schemasInternal) {
        this._definitions = schemas;
        this._definitionsInternal = schemasInternal;
        this._prepare(validator);
        this._prepare(defaulter);
    }

    _prepare(validatorInstance) {
        validatorInstance.addFormat('url', this._validateUrl);
        validatorInstance.addFormat('cron', this._validateCron);
        validatorInstance.addFormat('pipeline-name', this._validatePipelineName);
        validatorInstance.addFormat('algorithm-name', this._validateAlgorithmName);
        Object.entries(this._definitions).forEach(([k, v]) => {
            validatorInstance.addSchema(v, `#/components/schemas/${k}`);
        });
    }

    addPipelineDefaults(pipeline) {
        this._addDefaults(this._definitions.pipeline, pipeline);
    }

    validateStoredInternal(pipeline) {
        this._validate(this._definitionsInternal.pipeline, pipeline, false);
    }

    validateRawSubPipeline(pipeline) {
        this._validate(this._definitionsInternal.rawSubPipeline, pipeline, false);
    }

    validateStoredSubPipeline(pipeline) {
        this._validate(this._definitionsInternal.storedSubPipeline, pipeline, false);
    }

    validateRunRawPipeline(pipeline) {
        this._validate(this._definitions.pipeline, pipeline, false, { checkFlowInput: true });
    }

    validateRunStoredPipeline(pipeline) {
        this._validate(this._definitions.storedPipeline, pipeline, false, { checkFlowInput: false });
    }

    validateCaching(request) {
        this._validate(this._definitions.caching, request, false);
    }

    validateStopPipeline(pipeline) {
        this._validate(this._definitions.stopRequest, pipeline, true);
    }

    validateUpdatePipeline(pipeline) {
        this._validate(this._definitions.pipeline, pipeline, true);
    }

    validateUpdateAlgorithm(algorithm) {
        this._validate(this._definitions.algorithm, algorithm, true);
        this._validateAlgorithmEnvVar(algorithm);
        this._validateMemory(algorithm);
    }

    validateAlgorithmBuild(algorithm) {
        this._validate(this._definitionsInternal.algorithmBuild, algorithm);
    }

    validateApplyAlgorithm(algorithm) {
        this._validate(this._definitions.algorithm, algorithm, true);
        this._validateMemory(algorithm);
    }

    validateName(pipeline) {
        this._validate(this._definitionsInternal.name, pipeline, false);
    }

    validatePipelineName(name) {
        this._validate(this._definitions.pipelineName, name, false);
    }

    validateBuildId(build) {
        this._validate(this._definitionsInternal.buildId, build, false);
    }

    validateCronRequest(options) {
        this._validate(this._definitions.cronRequest, options, false);
    }

    validateResultList(pipeline) {
        this._validate(this._definitionsInternal.list, pipeline, true);
    }

    validateJobID(pipeline) {
        this._validate(this._definitions.jobId, pipeline, false);
    }

    async validateAlgorithmName(pipeline) {
        const result = await stateManager.getAlgorithms();
        const algorithms = new Set(result.map(x => x.name));
        pipeline.nodes.forEach((node) => {
            if (!algorithms.has(node.algorithmName)) {
                throw new ResourceNotFoundError('algorithm', node.algorithmName);
            }
        });
    }

    async validateConcurrentPipelines(pipelines, jobId) {
        if (pipelines.options && pipelines.options.concurrentPipelines) {
            const { concurrentPipelines } = pipelines.options;
            const jobIdPrefix = jobId.match(regex.JOB_ID_PREFIX_REGEX);
            if (jobIdPrefix) {
                const result = await stateManager.getRunningPipelines({ jobId: jobIdPrefix[0] });
                if (result.length >= concurrentPipelines) {
                    throw new InvalidDataError(`maximum number [${concurrentPipelines}] of concurrent pipelines has been reached`);
                }
            }
        }
    }

    _validate(schema, object, useDefaults, options) {
        if (useDefaults) {
            this._validateInner(defaulter, schema, object, options);
        }
        else {
            this._validateInner(validator, schema, object, options);
        }
    }

    _validateInner(validatorInstance, schema, obj, options) {
        const object = obj || {};
        const valid = validatorInstance.validate(schema, object);
        if (!valid) {
            const { errors } = validatorInstance;
            let error = validatorInstance.errorsText(errors);
            if (errors[0].params && errors[0].params.allowedValues) {
                error += ` (${errors[0].params.allowedValues.join(',')})`;
            }
            throw new InvalidDataError(error);
        }
        if (object.nodes) {
            this._validateNodes(object, options);
        }
    }

    _addDefaults(schema, object) {
        defaulter.validate(schema, object);
    }

    _validateNodes(pipeline, opt) {
        const options = opt || {};
        const graph = new Graph();
        const links = [];

        pipeline.nodes.forEach((node) => {
            if (graph.node(node.nodeName)) {
                throw new InvalidDataError(`found duplicate node ${node.nodeName}`);
            }
            if (node.nodeName === 'flowInput') {
                throw new InvalidDataError(`pipeline ${pipeline.name} has invalid reserved name flowInput`);
            }

            if (node.input) {
                node.input.forEach((inp) => {
                    if (options.checkFlowInput) {
                        try {
                            parser.checkFlowInput({ flowInput: pipeline.flowInput, nodeInput: inp });
                        }
                        catch (e) {
                            throw new InvalidDataError(e.message);
                        }
                    }

                    const nodesNames = parser.extractNodesFromInput(inp);
                    nodesNames.forEach((n) => {
                        const nd = pipeline.nodes.find(f => f.nodeName === n.nodeName);
                        if (nd) {
                            links.push({ source: nd.nodeName, target: node.nodeName });
                        }
                        else {
                            throw new InvalidDataError(`node ${node.nodeName} is depend on ${n.nodeName} which is not exists`);
                        }
                    });
                });
            }
            graph.setNode(node.nodeName, node);
        });

        links.forEach((link) => {
            graph.setEdge(link.source, link.target);
        });

        if (!alg.isAcyclic(graph)) {
            throw new InvalidDataError(`pipeline ${pipeline.name} has cyclic nodes`);
        }
    }

    _validateUrl(url) {
        return regex.URL_REGEX.test(url);
    }

    _validatePipelineName(name) {
        if (!regex.PIPELINE_NAME_REGEX.test(name)) {
            throw new InvalidDataError('pipeline name must contain only alphanumeric, dash, dot or underscore');
        }
        return true;
    }

    _validateAlgorithmName(name) {
        if (!regex.ALGORITHM_NAME_REGEX.test(name)) {
            throw new InvalidDataError('algorithm name must contain only lower-case alphanumeric, dash or dot');
        }
        return true;
    }

    _validateMemory(algorithm) {
        let memory;
        const { mem } = algorithm;
        const memReadable = algorithm.mem;
        if (!mem) {
            memory = 4;
        }
        else {
            try {
                memory = converter.getMemoryInMi(mem);
                if (memory < MIN_MEMORY) {
                    throw new InvalidDataError(`memory must be at least ${MIN_MEMORY} Mi`);
                }
            }
            catch (ex) {
                throw new InvalidDataError(ex.message);
            }
        }
        algorithm.mem = memory;               // eslint-disable-line
        algorithm.memReadable = memReadable;  // eslint-disable-line
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
                const valid = validator.validate(this._definitionsInternal.kubernetesValueFrom, key);
                if (!valid) {
                    throw new InvalidDataError(`${key} is invalid, only ${this._definitionsInternal.kubernetesValueFrom.enum.join(',')}`);
                }
            }
        });
    }

    _isObject(object) {
        return Object.prototype.toString.call(object) === '[object Object]';
    }

    _validateCron(cron) {
        let result = true;
        try {
            new CronJob(cron); // eslint-disable-line
        }
        catch (e) {
            result = false;
        }
        return result;
    }
}

module.exports = new ApiValidator();
