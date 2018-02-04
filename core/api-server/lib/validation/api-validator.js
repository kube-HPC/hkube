
const validator = require('djsv');
const { parser } = require('@hkube/parsers');
const { Graph, alg } = require('graphlib');
const { schemas } = require('../../api/rest-api/swagger.json').components;
const { InvalidDataError, } = require('../errors/errors');
const URL_REGEX = /^(f|ht)tps?:\/\//i;

class Validator {
    constructor() {
        validator.addFormat('url', this._validateWebhook);
        Object.values(schemas).forEach((s) => {
            if (s.id) {
                validator.addSchema(s);
            }
        });
    }

    addDefaults(pipeline) {
        pipeline.options = pipeline.options || {};
        if (!pipeline.options.batchTolerance) {
            pipeline.options.batchTolerance = 80;
        }
        if (!pipeline.options.progressVerbosityLevel) {
            pipeline.options.progressVerbosityLevel = 'info';
        }
        if (!pipeline.priority) {
            pipeline.priority = 3;
        }
    }

    validateRunRawPipeline(pipeline) {
        this._validate(schemas.pipeline, pipeline, { checkFlowInput: true });
    }

    validateRunStoredPipeline(pipeline) {
        this._validate(schemas.runStoredPipeline, pipeline, { checkFlowInput: false });
    }

    validateStopPipeline(pipeline) {
        this._validate(schemas.stopRequest, pipeline);
    }

    validateUpdatePipeline(pipeline) {
        this._validate(schemas.updatePipeline, pipeline);
    }

    validateDeletePipeline(pipeline) {
        this._validate(schemas.pipelineName, pipeline);
    }

    validateInsertPipeline(pipeline) {
        this._validate(schemas.pipeline, pipeline);
    }

    validateGetPipeline(pipeline) {
        this._validate(schemas.pipelineName, pipeline);
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

    _validateWebhook(url) {
        return URL_REGEX.test(url);
    }
}

module.exports = new Validator();
