const { NodesMap: DAG } = require('@hkube/dag');
const { parser, consts } = require('@hkube/parsers');
const { pipelineKind } = require('@hkube/consts');
const stateManager = require('../state/state-manager');
const { InvalidDataError, } = require('../errors');
const { relations } = consts;

class CachingService {
    async exec({ jobId, nodeName }) {
        const stored = await this._getStoredExecution(jobId);
        this._validate(stored);
        const { successors } = this._findRelations(stored, nodeName);
        const pipeline = this._createSubPipeline(stored, nodeName, successors);
        return pipeline;
    }

    _validate(pipeline) {
        if (pipeline.kind === pipelineKind.Stream) {
            throw new InvalidDataError(`run node is not allowed in ${pipeline.kind} pipeline`);
        }
        const node = pipeline.nodes.find(n => parser.findNodeRelation(n.input, relations.WAIT_ANY));
        if (node) {
            throw new InvalidDataError(`relation ${relations.WAIT_ANY} for node ${node.nodeName} is not allowed`);
        }
    }

    _createSubPipeline(pipeline, nodeName, successors) {
        const nodes = [];
        pipeline.nodes.forEach((n) => {
            if (n.nodeName === nodeName) {
                n.cacheJobId = pipeline.rootJobId || pipeline.jobId; // eslint-disable-line
            }
            if (successors.includes(n.nodeName)) {
                nodes.push(n);
            }
        });
        return { ...pipeline, nodes };
    }

    _flatten(nodes, nodeName) {
        const flatten = new Set();
        flatten.add(nodeName);
        if (nodes) {
            nodes.forEach((n) => {
                if (!flatten.has(n)) {
                    flatten.add(n);
                }
            });
        }
        return [...flatten];
    }

    async _getStoredExecution(jobId) {
        const pipeline = await stateManager.getJobPipeline({ jobId });
        if (!pipeline) {
            throw new InvalidDataError(`unable to find pipeline ${jobId}`);
        }
        return pipeline;
    }

    _findRelations(pipeline, nodeName) {
        const graph = new DAG(pipeline, { validateNodesRelations: false });
        const successorsMap = this._getSuccessors(graph, nodeName);
        const successors = this._flatten(successorsMap, nodeName);
        return { successors };
    }

    _getSuccessors(graph, nodeName, res = []) {
        const successors = graph._childs(nodeName);
        if (!successors) {
            throw new InvalidDataError(`cant find relations for ${nodeName}`);
        }
        if (successors.length === 0) {
            return null;
        }
        res.push(...successors);
        successors.forEach(p => this._getSuccessors(graph, p, res));
        return res;
    }
}

module.exports = new CachingService();
