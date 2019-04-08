
const uuidv4 = require('uuid/v4');
const cloneDeep = require('lodash.clonedeep');
const log = require('@hkube/logger').GetLogFromContainer();
const storageManager = require('@hkube/storage-manager');
const { componentName } = require('./consts/index');
const { splitInputToNodes } = require('./input-parser');
const NodesMap = require('../lib/create-graph');

// const { main } = require('@hkube/config').load();
// const { protocol, host, port, base_path } = main.apiServer;


class Runner {
    async init(options) {
        this._options = options;
    }

    async parse(jobId, nodeName) {
        try {
            const originalJobId = this._getOriginialJobId(jobId);
            const pipeline = await this._getStoredExecution(originalJobId);
            const { successors, predecessors } = this._createGraphAndFindRelevantSuccessorsAndPredecessors(pipeline, nodeName);
            const flattenSuccessors = this._flattenSuccessors(successors, nodeName);
            const flattenPredecessors = this._flattenPredecessors(predecessors, nodeName);
            const subPipeline = this._createSubPipeline(flattenSuccessors, pipeline, originalJobId);
            const metadataFromPredecessors = await this._collectMetaDataFromPredecessors(originalJobId, flattenPredecessors);
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

    _getOriginialJobId(jobId) {
        return jobId.split(':caching')[0];
    }

    _mergeSubPipelineWithMetadata(subPipeline, flattenPredecessors, metadataFromSuccessors) {
        subPipeline.nodes.forEach((n) => {
            const dependentNodes = splitInputToNodes(n.input, flattenPredecessors);
            // finish adding caching
            if (dependentNodes) {
                n.parentOutput = []; //eslint-disable-line
                dependentNodes.forEach((dn) => {
                    const metadata = metadataFromSuccessors.find(ms => ms.id === dn);
                    if (metadata) {
                        n.parentOutput.push(...metadata.metadata);
                    }
                    else {
                        log.error(`couldn't find any matched caching object for node dependency ${dn}`, { componentName: componentName.RUNNER });
                    }
                });
                if (n.parentOutput.length === 0) {
                    n.parentOutput = null;//eslint-disable-line
                }
            }
        });
        return subPipeline;
    }

    _createSubPipeline(flattenSuccessors, pipeline) {
        const uuidSuffix = uuidv4().split('-')[0];
        const deepPipelineExecution = cloneDeep(pipeline);
        deepPipelineExecution.name = `${pipeline.name}:${uuidSuffix}`;
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
            return storageManager.hkubeExecutions.get({ jobId });
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
            metadata = await Promise.all(flattenPredecessors.map(async p => ({
                id: p,
                metadata: await this._getMetaDataFromStorageAndCreateDescriptior(jobId, p)
            })));
        }
        catch (error) {
            log.error(`error on getting metadata from custom storage ${error}`);
        }
        return metadata;
    }

    async _getMetaDataFromStorageAndCreateDescriptior(jobId, nodeName) {
        try {
            const metadataPathList = await storageManager.hkubeMetadata.list({ jobId, nodeName });
            const metadataList = await Promise.all(metadataPathList.map(async (path) => {
                const metadata = await storageManager.get(path);
                return {
                    node: nodeName,
                    type: 'waitNode',
                    result: metadata.result
                };
            }));

            return metadataList;
        }
        catch (error) {
            log.error(`fail to get metadata from custom resource ${error}`, { component: componentName.RUNNER });
            // eslint-disable-next-line consistent-return
            return null;
        }
    }
}


module.exports = new Runner();
