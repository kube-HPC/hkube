const Validator = require('ajv');
const converter = require('@hkube/units-converter');
const { CronJob } = require('cron');
const { Graph, alg } = require('graphlib');
const { parser } = require('@hkube/parsers');
const regex = require('../consts/regex');
const stateManager = require('../state/state-manager');
const validationMessages = require('../consts/validationMessages');
const { ResourceNotFoundError, InvalidDataError } = require('../errors');
const validator = new Validator({ useDefaults: false, coerceTypes: true, nullable: true });
const defaulter = new Validator({ useDefaults: true, coerceTypes: true, nullable: true });
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
        validatorInstance.addFormat('algorithm-mount-pvc', this._validateAlgorithmMountPvc);
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

    validateExperimentName(experiment) {
        this._validate(this._definitions.experiment, experiment, true);
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
        this._validate(this._definitionsInternal.pipeline, pipeline, false);
    }

    validateRawSubPipeline(pipeline) {
        this._validate(this._definitionsInternal.rawSubPipeline, pipeline, false);
    }

    validateStoredSubPipeline(pipeline) {
        this._validate(this._definitionsInternal.storedSubPipeline, pipeline, false);
    }

    validatePipeline(pipeline, options = {}) {
        this._validate(this._definitions.pipeline, pipeline, false, { checkFlowInput: true, ...options });
    }

    validateRunRawPipeline(pipeline) {
        this._validate(this._definitions.pipeline, pipeline, false, { checkFlowInput: true });
    }

    validateRunStoredPipeline(pipeline) {
        this._validate(this._definitions.storedPipelineRequest, pipeline, false);
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

    async validateAlgorithmResources(algorithm) {
        const resources = await stateManager.discovery.get({ serviceName: 'task-executor' });
        if (resources && resources.nodes) {
            const { cpu, gpu } = algorithm;
            const mem = converter.getMemoryInMi(algorithm.mem);
            const nodes = resources.nodes.map(n => this._findNodeForSchedule(n, { cpu, mem, gpu }));
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
        const cpuAvailable = cpu < node.total.cpu;
        const memAvailable = mem < node.total.mem;
        const gpuAvailable = gpu > 0 ? gpu < node.total.gpu : true;

        return {
            node,
            available: cpuAvailable && memAvailable && gpuAvailable,
            details: { cpu: cpuAvailable, mem: memAvailable, gpu: gpuAvailable }
        };
    }

    async validateAlgorithmExists(pipeline) {
        const algorithms = new Map();
        const algorithmList = await stateManager.algorithms.store.list({ limit: 1000 });
        const algorithmsMap = new Map(algorithmList.map((a) => [a.name, a]));
        pipeline.nodes.forEach((node) => {
            const algorithm = algorithmsMap.get(node.algorithmName);
            if (!algorithm) {
                throw new ResourceNotFoundError('algorithm', node.algorithmName);
            }
            algorithms.set(node.algorithmName, algorithm);
        });
        return algorithms;
    }

    async validateExperimentExists(pipeline) {
        const { experimentName } = pipeline;
        const result = await stateManager.experiments.get({ name: experimentName });
        if (!result) {
            throw new ResourceNotFoundError('experiment', experimentName);
        }
    }

    async validateConcurrentPipelines(pipelines, jobId) {
        if (pipelines.options && pipelines.options.concurrentPipelines) {
            const { amount, rejectOnFailure } = pipelines.options.concurrentPipelines;
            const jobIdPrefix = jobId.match(regex.JOB_ID_PREFIX_REGEX);
            if (jobIdPrefix) {
                const result = await stateManager.executions.running.list({ jobId: jobIdPrefix[0] });
                if (result.length >= amount) {
                    if (rejectOnFailure) {
                        throw new InvalidDataError(`maximum number [${amount}] of concurrent pipelines has been reached`);
                    }
                    return true;
                }
            }
        }
        return false;
    }

    _validate(schema, object, useDefaults, options) {
        if (useDefaults) {
            this._validateInner(defaulter, schema, object, options);
        }
        else {
            this._validateInner(validator, schema, object, options);
        }
    }

    _validateInner(validatorInstance, schema, obj, options = { checkFlowInput: false, validateNodes: true }) {
        const object = obj || {};
        const valid = validatorInstance.validate(schema, object);
        if (!valid) {
            const { errors } = validatorInstance;
            let error = validatorInstance.errorsText(errors, { extraInfo: true });
            if (errors[0].params && errors[0].params.allowedValues) {
                error += ` (${errors[0].params.allowedValues.join(',')})`;
            }
            else if (errors[0].params && errors[0].params.additionalProperty) {
                error += ` (${errors[0].params.additionalProperty})`;
            }
            throw new InvalidDataError(error);
        }
        if (object.nodes && options.validateNodes !== false) {
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

    _validateAlgorithmMountPvc(name) {
        return name && regex.PVC_NAME_REGEX.test(name) && name.length < 64;
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
        const errorsTextWapper = (errors, options) => {
            let message;
            if (errors) {
                message = this.getCustomMessage(errors[0]);
            }
            return message || wrappedFn(errors, options);
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
