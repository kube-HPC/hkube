
const validator = require('djsv');
const converter = require('@hkube/units-converter');
const { parser } = require('@hkube/parsers');
const { Graph, alg } = require('graphlib');
const { CronJob } = require('cron');
const { schemas, _schemas } = require('../../api/rest-api/swagger.json').components;
const { InvalidDataError, } = require('../errors/errors');
const URL_REGEX = /^(f|ht)tps?:\/\//i;
const MIN_MEMORY = 4;

class Validator {
    constructor() {
        validator.addFormat('url', this._validateUrl);
        validator.addFormat('cron', this._validateCron);
        Object.values(schemas).forEach((s) => {
            if (s.id) {
                validator.addSchema(s);
            }
        });
    }

    addDefaults(pipeline) {
        pipeline.options = pipeline.options || {};
        if (!Number.isInteger(pipeline.options.batchTolerance)) {
            pipeline.options.batchTolerance = 80;
        }
        if (!Number.isInteger(pipeline.priority)) {
            pipeline.priority = 3;
        }
        if (!pipeline.options.progressVerbosityLevel) {
            pipeline.options.progressVerbosityLevel = 'info';
        }
    }

    validateStoredInternal(pipeline) {
        this._validate(_schemas.storedInternal, pipeline);
    }

    validateRunRawPipeline(pipeline) {
        this._validate(schemas.pipeline, pipeline, { checkFlowInput: true });
    }

    validateRunStoredPipeline(pipeline) {
        this._validate(schemas.storedPipeline, pipeline, { checkFlowInput: false });
    }

    validateStopPipeline(pipeline) {
        this._validate(schemas.stopRequest, pipeline);
    }

    validateInsertPipeline(pipeline) {
        this._validate(schemas.pipeline, pipeline);
    }

    validateUpdatePipeline(pipeline) {
        this._validate(schemas.updatePipeline, pipeline);
    }

    validateUpdateAlgorithm(algorithm) {
        this._validate(schemas.algorithm, algorithm);
        this._validateMemory(algorithm);
    }

    validateName(pipeline) {
        this._validate(schemas.name, pipeline);
    }

    validateResultList(pipeline) {
        if (!pipeline.limit) {
            pipeline.limit = 1;
        }
        pipeline.limit = parseInt(pipeline.limit, 10);
        this._validate(_schemas.list, pipeline);
    }

    validateJobID(pipeline) {
        this._validate(schemas.jobId, pipeline);
    }

    _validate(schema, object, options) {
        const res = validator(schema, object);
        if (!res.valid) {
            throw new InvalidDataError(res.error);
        }
        if (object.nodes) {
            this._validateNodes(object, options);
        }
    }

    _validateNodes(pipeline, options) {
        options = options || {};
        const graph = new Graph();
        const links = [];

        pipeline.nodes.forEach((node) => {
            if (graph.node(node.nodeName)) {
                throw new InvalidDataError(`found duplicate node ${node.nodeName}`);
            }
            if (node.nodeName === 'flowInput') {
                throw new InvalidDataError(`pipeline ${pipeline.name} has invalid reserved name flowInput`);
            }

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
            graph.setNode(node.nodeName, node);
        });

        links.forEach((link) => {
            graph.setEdge(link.source, link.target);
        });

        if (!alg.isAcyclic(graph)) {
            throw new InvalidDataError(`pipeline ${pipeline.name} has cyclic nodes`);
        }
        if (!graph.isDirected()) {
            throw new InvalidDataError(`pipeline ${pipeline.name} is not directed graph`);
        }
    }

    _validateUrl(url) {
        return URL_REGEX.test(url);
    }

    _validateMemory(algorithm) {
        if (!algorithm.mem) {
            algorithm.mem = 4;
            return;
        }
        try {
            algorithm.mem = converter.getMemoryInMi(algorithm.mem);
        }
        catch (ex) {
            throw new InvalidDataError(ex.message);
        }
        if (algorithm.mem < MIN_MEMORY) {
            throw new InvalidDataError(`memory must be at least ${MIN_MEMORY} Mi`);
        }
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

module.exports = new Validator();
