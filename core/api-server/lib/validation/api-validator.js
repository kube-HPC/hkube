
const validator = require('djsv');
const randString = require('crypto-random-string');
const converter = require('@hkube/units-converter');
const { parser } = require('@hkube/parsers');
const { Graph, alg } = require('graphlib');
const { CronJob } = require('cron');
const { schemas, _schemas } = require('../../api/rest-api/swagger.json').components;
const { InvalidDataError, } = require('../errors/errors');
const URL_REGEX = /^(f|ht)tps?:\/\//i;
const NAME_REGEX = /^[-_.A-Za-z0-9]+$/i;
const MIN_MEMORY = 4;

class Validator {
    constructor() {
        validator.addFormat('url', this._validateUrl);
        validator.addFormat('cron', this._validateCron);
        validator.addFormat('name', this._validateName);
        Object.entries(schemas).forEach(([k, v]) => {
            v.id = `#/components/schemas/${k}`;
            validator.addSchema(v);
        });
    }

    validateStoredInternal(pipeline) {
        this._validate(_schemas.storedInternal, pipeline);
    }

    validateRunRawPipeline(pipeline) {
        this._validate(schemas.pipeline, pipeline, { checkFlowInput: true });
        pipeline.name = `raw-${pipeline.name}-${randString(10)}`;
    }

    validateRunStoredPipeline(pipeline) {
        this._validate(schemas.storedPipeline, pipeline, { checkFlowInput: false });
    }

    validateStopPipeline(pipeline) {
        this._validate(schemas.stopRequest, pipeline);
    }

    validateUpdatePipeline(pipeline) {
        this._validate(schemas.pipeline, pipeline);
    }

    validateUpdateAlgorithm(algorithm) {
        this._validate(schemas.algorithm, algorithm);
        this._validateMemory(algorithm);
    }

    validateName(pipeline) {
        this._validate(_schemas.name, pipeline);
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

    _validateName(name) {
        if (!NAME_REGEX.test(name)) {
            throw new InvalidDataError('name must contain only alphanumeric, dash, dot or underscore');
        }
        return true;
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
