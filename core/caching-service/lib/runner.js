
const cloneDeep = require('lodash.clonedeep');
const { Persistency } = require('@hkube/dag');
const log = require('@hkube/logger').GetLogFromContainer();
const Etcd = require('@hkube/etcd');
const { componentName } = require('./consts/index');
const { splitInputToNodes } = require('./input-parser');
const NodesMap = require('./create-graph');

class Runner {
    async init(options) {
        this._options = options;
        this._etcd = new Etcd(options.etcd);
        this._graphPersistency = new Persistency({ connection: options.redis });
    }

    async parse(jobId, nodeName) {
        try {
            const pipeline = await this._getStoredExecution(jobId);
            const { successors, predecessors } = this._createGraphAndFindRelevantSuccessorsAndPredecessors(pipeline, nodeName);
            const flattenSuccessors = this._flattenSuccessors(successors, nodeName);
            const flattenPredecessors = this._flattenPredecessors(predecessors, nodeName);
            const subPipeline = this._createSubPipeline(flattenSuccessors, pipeline);
            const metadataFromPredecessors = await this._collectMetaDataFromPredecessors(jobId, flattenPredecessors);
            const mergedPipeline = this._mergeSubPipelineWithMetadata(subPipeline, flattenPredecessors, metadataFromPredecessors);
            log.debug(`new pipeline sent for running: ${JSON.stringify(mergedPipeline)} `);
            return mergedPipeline;
        }
        catch (error) {
            log.error(`fail to parse ${jobId} pipeline for caching on nodeName ${nodeName}
             errorMessage: ${error.message}, stack: ${error.stack}`, { component: componentName.RUNNER });
            throw new Error(`part of the data is missing or incorrect error:${error.message} `);
        }
    }

    _mergeSubPipelineWithMetadata(subPipeline, flattenPredecessors, metadataFromSuccessors) {
        subPipeline.nodes.forEach((n) => {
            const dependentNodes = splitInputToNodes(n.input, flattenPredecessors);
            // finish adding caching
            n.parentOutput = []; //eslint-disable-line
            dependentNodes.forEach((dn) => {
                const metadata = metadataFromSuccessors.find(ms => ms.id === dn);
                if (metadata) {
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
        const deepPipelineExecution = cloneDeep(pipeline);
        deepPipelineExecution.name = pipeline.name;
        deepPipelineExecution.nodes = [];
        flattenSuccessors.forEach((s) => {
            const node = pipeline.nodes.find(n => n.nodeName === s);
            if (node) {
                deepPipelineExecution.nodes.push(node);
            }
        });
        return deepPipelineExecution;
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
        try {
            return this._etcd.executions.stored.get({ jobId });
        }
        catch (error) {
            log.error(`cant find execution for jobId ${jobId}`, { component: componentName.RUNNER });
            throw new Error(`cant find execution for jobId ${jobId}`);
        }
    }

    _createGraphAndFindRelevantSuccessorsAndPredecessors(pipeline, nodeName) {
        const builtGraph = new NodesMap(pipeline.nodes);
        return {
            successors: builtGraph.getAllSuccessors(nodeName),
            predecessors: builtGraph.getAllPredecessors(nodeName)
        };
    }

    async _collectMetaDataFromPredecessors(jobId, flattenPredecessors) {
        let metadata = null;
        try {
            const jsonGraph = await this._graphPersistency.getGraph({ jobId });
            const graph = JSON.parse(jsonGraph);
            metadata = await Promise.all(flattenPredecessors.map(async p => ({
                id: p,
                metadata: await this._getMetaDataFromStorageAndCreateDescriptior(graph, p)
            })));
        }
        catch (error) {
            log.error(`error on getting metadata from custom storage ${error}`);
        }
        return metadata;
    }

    async _getMetaDataFromStorageAndCreateDescriptior(graph, nodeName) {
        try {
            let result;
            const node = graph.nodes.find(n => n.nodeName === nodeName);

            if (node.batch && node.batch.length > 0) {
                result = {
                    node: nodeName,
                    type: 'waitNode',
                    result: node.batch.map(b => b.output)
                };
            }
            else {
                result = {
                    node: nodeName,
                    type: 'waitNode',
                    result: node.output

                };
            }
            return result;
        }
        catch (error) {
            log.error(`fail to get metadata from custom resource ${error}`, { component: componentName.RUNNER });
            // eslint-disable-next-line consistent-return
            return null;
        }
    }
}

module.exports = new Runner();
