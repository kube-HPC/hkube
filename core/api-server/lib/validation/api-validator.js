
const validator = require('djsv');
const inputParser = require('lib/parsers/input-parser');
const { Graph, alg } = require('graphlib');
const schemas = require('api/rest-api/swagger.json').components.schemas;
const { InvalidDataError, } = require('lib/errors/errors');

class Validator {

    constructor() {
        //validator.addFormat('url', '(http|ftp|https)://[\w-]+(\.[\w-]+)*([\w.,@?^=%&amp;:/~+#-]*[\w@?^=%&amp;/~+#-])?')
        Object.values(schemas).forEach((s) => {
            if (s.id) {
                validator.addSchema(s);
            }
        });
    }

    validateRunRawPipeline(pipeline) {
        this._validate(schemas.pipeline, pipeline);
    }

    validateRunStoredPipeline(pipeline) {
        this._validate(schemas.runStoredPipeline, pipeline);
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

    validateExecutionID(pipeline) {
        this._validate(schemas.jobId, pipeline);
    }

    _validate(schema, object) {
        const res = validator(schema, object);
        if (!res.valid) {
            throw new InvalidDataError(res.error);
        }
        if (object.nodes) {
            this._validateNodes(object);
        }
    }

    _validateNodes(options) {
        const graph = new Graph();
        const links = [];

        options.nodes.forEach(node => {
            if (graph.node(node.nodeName)) {
                throw new InvalidDataError(`found duplicate node ${node.nodeName}`);
            }
            if (node.nodeName === 'flowInput') {
                throw new InvalidDataError(`pipeline ${options.name} has invalid reserved name flowInput`);
            }

            node.input.forEach((inp, ind) => {
                inputParser.checkFlowInput(options, inp);
                const nodesNames = inputParser.extractNodesFromInput(inp);
                nodesNames.forEach(n => {
                    const nd = options.nodes.find(f => f.nodeName === n);
                    if (nd) {
                        links.push({ source: nd.nodeName, target: node.nodeName })
                    }
                    else {
                        throw new InvalidDataError(`node ${node.nodeName} is depend on ${n} which is not exists`);
                    }
                })
            })
            graph.setNode(node.nodeName, node);
        });

        links.forEach(link => {
            graph.setEdge(link.source, link.target);
        });

        if (!alg.isAcyclic(graph)) {
            throw new InvalidDataError(`pipeline ${options.name} has cyclic nodes`);
        }
        if (!graph.isDirected()) {
            throw new InvalidDataError(`pipeline ${options.name} has not directed nodes`);
        }
    }
}

module.exports = new Validator();
