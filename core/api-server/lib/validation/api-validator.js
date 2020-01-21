const Validator = require('ajv');
const converter = require('@hkube/units-converter');
const { CronJob } = require('cron');
const { Graph, alg } = require('graphlib');
const { parser } = require('@hkube/parsers');
const regex = require('../../lib/consts/regex');
const stateManager = require('../state/state-manager');
const validationMessages = require('../consts/validationMessages');
const { ResourceNotFoundError, InvalidDataError } = require('../errors');
const validator = new Validator({ useDefaults: false, coerceTypes: true });
const defaulter = new Validator({ useDefaults: true, coerceTypes: true });
const MIN_MEMORY = 4;
const formatMessages = new Map();

class ApiValidator {
    init(schemas, schemasInternal) {
        this._definitions = schemas;
        this._definitionsInternal = schemasInternal;
        this._prepare(validator);
        this._prepare(defaulter);
    }

    _prepare(validatorInstance) {
        validatorInstance.errorsText = this.wrapErrorMessageFn(validatorInstance.errorsText.bind(validatorInstance)).bind(this);// eslint-disable-line
        validatorInstance.addFormat('url', this._validateUrl);
        validatorInstance.addFormat('cron', this._validateCron);
        validatorInstance.addFormat('pipeline-name', this._validatePipelineName);
        validatorInstance.addFormat('experiment-name', this._validateExperimentName);
        validatorInstance.addFormat('algorithm-name', this._validateAlgorithmName);
        validatorInstance.addFormat('algorithm-image', this._validateAlgorithmImage);
        validatorInstance.addFormat('algorithm-memory', this._validateMemory);
        validatorInstance.addFormat('path', this._validatePath);
        formatMessages.set('pipeline-name', validationMessages.PIPELINE_NAME_FORMAT);
        formatMessages.set('algorithm-name', validationMessages.ALGORITHM_NAME_FORMAT);
        formatMessages.set('algorithm-image', validationMessages.ALGORITHM_IMAGE_FORMAT);
        formatMessages.set('board-name', validationMessages.BOARD_NAME_FORMAT);
        formatMessages.set('experiment-name', validationMessages.EXPERIMENT_NAME_FORMAT);

        Object.entries(this._definitions).forEach(([k, v]) => {
            validatorInstance.addSchema(v, `#/components/schemas/${k}`);
        });
    }

    addPipelineDefaults(pipeline) {
        this._addDefaults(this._definitions.pipeline, pipeline);
    }

    addAlgorithmDefaults(algorithm) {
        this._addDefaults(this._definitions.algorithm, algorithm);
    }

    validateListRange(options) {
        this._validate(this._definitionsInternal.listRange, options);
    }

    validateAlgorithmName(algorithm) {
        this._validate(this._definitionsInternal.algorithmName, algorithm);
    }

    validateGraphQuery(options) {
        this._validate(this._definitionsInternal.graph, options, true);
    }

    validateStoredInternal(pipeline) {
        this._validate(this._definitionsInternal.pipeline, pipeline, true);
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
        this._validate(this._definitions.storedPipelineRequest, pipeline, false, { checkFlowInput: false });
    }

    validateCaching(request) {
        this._validate(this._definitions.caching, request, false);
    }

    validateExecAlgorithmRequest(request) {
        this._validate(this._definitions.execAlgorithmRequest, request, false);
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
    }

    validateApplyAlgorithm(algorithm) {
        this._validate(this._definitions.algorithm, algorithm, false);
        this._validateAlgorithmEnvVar(algorithm);
    }

    validateAlgorithmVersion(algorithm) {
        this._validate(this._definitions.algorithmVersion, algorithm, false);
    }

    validateAlgorithmBuild(algorithm) {
        this._validate(this._definitions.algorithmBuild, algorithm);
    }

    validateAlgorithmBuildFromGit(algorithm) {
        this._validate(this._definitions.algorithmBuildGit, algorithm);
    }

    validateName(pipeline) {
        this._validate(this._definitionsInternal.name, pipeline, false);
    }

    validateAlgorithmDelete(algorithm) {
        this._validate(this._definitionsInternal.algorithmDelete, algorithm, true);
    }

    validatePipelineName(name) {
        this._validate(this._definitions.pipelineName, name, false);
    }

    validateBuildId(build) {
        this._validate(this._definitionsInternal.buildId, build, false);
    }

    validateCreateBoardReq(board) {
        const { taskId, jobId, nodeName, pipelineName } = board;
        if (taskId && !jobId) {
            throw new InvalidDataError('Must supply jobId');
        }
        if (!nodeName && !taskId) {
            throw new InvalidDataError('Must supply nodeName');
        }
        if (!jobId && !pipelineName) {
            throw new InvalidDataError('Must supply pipeLineName');
        }
    }

    validateCronRequest(options) {
        this._validate(this._definitions.cronRequest, options, false);
    }

    validateResultList(pipeline) {
        this._validate(this._definitionsInternal.list, pipeline, true);
    }

    validateJobID(pipeline) {
        this._validate(this._definitions.jobIdObject, pipeline, false);
    }

    async validateAlgorithmExists(pipeline) {
        const result = await stateManager.getAlgorithms();
        const algorithms = new Set(result.map(x => x.name));
        pipeline.nodes.forEach((node) => {
            if (!algorithms.has(node.algorithmName)) {
                throw new ResourceNotFoundError('algorithm', node.algorithmName);
            }
        });
    }

    async validateExperimentExists(experimentName) {
        const result = await stateManager.getExperiment({ experimentName });
        if (result === null) {
            throw new ResourceNotFoundError('experiment', experimentName);
        }
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
        return regex.PIPELINE_NAME_REGEX.test(name);
    }

    _validateExperimentName(name) {
        return regex.EXPERIMENT_NAME_REGEX.test(name);
    }

    _validateBoardName(name) {
        return regex.BOARD_ID.test(name);
    }

    _validatePath(path) {
        return regex.PATH.test(path);
    }

    _validateAlgorithmName(name) {
        return regex.ALGORITHM_NAME_REGEX.test(name);
    }

    _validateAlgorithmImage(image) {
        return regex.ALGORITHM_IMAGE_REGEX.test(image);
    }

    _validateMemory(memory) {
        try {
            const mem = converter.getMemoryInMi(memory);
            if (mem < MIN_MEMORY) {
                throw new InvalidDataError(`memory must be at least ${MIN_MEMORY} Mi`);
            }
        }
        catch (ex) {
            throw new InvalidDataError(ex.message);
        }
        return true;
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

    wrapErrorMessageFn(wrappedFn) {
        const errorsTextWapper = (errors) => {
            let message;
            if (errors) {
                message = this.getCustomMessage(errors[0]);
            }
            return message || wrappedFn(errors);
        };
        return errorsTextWapper;
    }

    getCustomMessage(e) {
        if (e.keyword === 'format') {
            return formatMessages.get(e.params.format);
        }
        return undefined;
    }
}

module.exports = new ApiValidator();
