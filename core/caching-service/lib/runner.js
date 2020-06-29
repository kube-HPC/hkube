const cloneDeep = require('lodash.clonedeep');
const { Persistency } = require('@hkube/dag');
const log = require('@hkube/logger').GetLogFromContainer();
const Etcd = require('@hkube/etcd');
const { componentName } = require('./consts/index');
const { splitInputToNodes, validateType } = require('./input-parser');
const NodesMap = require('./create-graph');

class Runner {
    async init(options) {
        this._options = options;
        this._etcd = new Etcd(options.etcd);
        await this._etcd.jobs.status.watch({ jobId: 'hookWatch' });
        this._graphPersistency = new Persistency({ connection: options.redis });
    }

    async parse(jobId, nodeName) {
        const pipeline = await this._getStoredExecution(jobId);
        validateType(pipeline.nodes);
        const { successors, predecessors } = this._findRelations(pipeline, nodeName);
        const subPipeline = this._createSubPipeline(successors, pipeline);
        const predecessorsResult = await this._getResultFromPredecessors(jobId, predecessors);
        const mergedPipeline = this._mergeSubPipelineWithMetadata(subPipeline, predecessors, predecessorsResult);
        log.debug(`new pipeline sent for running: ${JSON.stringify(mergedPipeline)}`);
        return mergedPipeline;
    }

    _mergeSubPipelineWithMetadata(subPipeline, flattenPredecessors, metadataFromSuccessors) {
        subPipeline.nodes.forEach((n) => {
            const nodes = splitInputToNodes(n.input, flattenPredecessors);
            // finish adding caching
            n.parentOutput = []; //eslint-disable-line
            nodes.forEach((dn) => {
                const metadata = metadataFromSuccessors.find(ms => ms.id === dn.nodeName);
                if (metadata) {
                    metadata.metadata.type = dn.type;
                    n.parentOutput.push(metadata.metadata);
                }
                else {
                    log.error(`couldn't find any matched caching object for node dependency ${dn}`, { componentName: componentName.RUNNER });
                }
            });
            if (n.parentOutput.length === 0) {
                n.parentOutput = null;//eslint-disable-line
            }
        });
        return subPipeline;
    }

    _createSubPipeline(flattenSuccessors, pipeline) {
        const newPipeline = cloneDeep(pipeline);
        newPipeline.nodes = pipeline.nodes.filter(n => flattenSuccessors.includes(n.nodeName));
        return newPipeline;
    }

    _flattenSuccessors(parentSuccessors, nodeName) {
        const flatten = new Set();
        flatten.add(nodeName);
        if (parentSuccessors) {
            parentSuccessors.forEach(s => s.successors.forEach((childSuccessor) => {
                if (!flatten.has(childSuccessor)) {
                    flatten.add(childSuccessor);
                }
            }));
        }
        return [...flatten];
    }

    _flattenPredecessors(parentPredecessors, nodeName) {
        const flatten = new Set();
        flatten.add(nodeName);
        if (parentPredecessors) {
            parentPredecessors.forEach(p => p.predecessors.forEach((childPredecessor) => {
                if (!flatten.has(childPredecessor)) {
                    flatten.add(childPredecessor);
                }
            }));
        }

        return [...flatten];
    }

    async _getStoredExecution(jobId) {
        const pipeline = await this._etcd.executions.stored.get({ jobId });
        if (!pipeline) {
            throw new Error(`unable to find pipeline ${jobId}`);
        }
        return pipeline;
    }

    _findRelations(pipeline, nodeName) {
        const builtGraph = new NodesMap(pipeline.nodes);
        const successorsMap = builtGraph.getAllSuccessors(nodeName);
        const predecessorsMap = builtGraph.getAllPredecessors(nodeName);
        const successors = this._flattenSuccessors(successorsMap, nodeName);
        const predecessors = this._flattenPredecessors(predecessorsMap, nodeName);
        return { successors, predecessors };
    }

    async _getResultFromPredecessors(jobId, flattenPredecessors) {
        const jsonGraph = await this._graphPersistency.getGraph({ jobId });
        const graph = JSON.parse(jsonGraph);
        const metadata = await Promise.all(flattenPredecessors.map(async p => ({
            id: p,
            metadata: await this._getNodeResult(graph, p)
        })));
        return metadata;
    }

    async _getNodeResult(graph, nodeName) {
        let result;
        const node = graph.nodes.find(n => n.nodeName === nodeName);

        if (node.batch && node.batch.length > 0) {
            result = {
                node: nodeName,
                result: node.batch.map(b => b.output)
            };
        }
        else {
            result = {
                node: nodeName,
                result: node.output
            };
        }
        return result;
    }
}

module.exports = new Runner();
