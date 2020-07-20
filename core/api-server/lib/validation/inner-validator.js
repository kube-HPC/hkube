const Validator = require('ajv');
const { Graph, alg } = require('graphlib');
const { parser } = require('@hkube/parsers');
const { InvalidDataError } = require('../errors');
const customFormats = require('./custom-formats');
const validator = new Validator({ useDefaults: false, coerceTypes: true, nullable: true });
const defaulter = new Validator({ useDefaults: true, coerceTypes: true, nullable: true });

class ApiValidator {
    init(schemas, schemasInternal) {
        this.definitions = schemas;
        this.definitionsInternal = schemasInternal;
        customFormats.init(schemas, validator, defaulter);
    }

    addDefaults(schema, object) {
        defaulter.validate(schema, object);
    }

    validate(schema, object, useDefaults, options) {
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
}

module.exports = new ApiValidator();
