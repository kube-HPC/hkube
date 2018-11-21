const request = require('requestretry');
const uuidv4 = require('uuid/v4');
const log = require('@hkube/logger').GetLogFromContainer();
const storageManager = require('@hkube/storage-manager')
const { componentName } = require('./consts/index')
const { main } = require('@hkube/config').load();
const { splitInputToNodes } = require('./input-parser')
const NodesMap = require('../lib/create-graph')
const { protocol, host, port, base_path } = main.apiServer;
const cloneDeep = require('lodash.clonedeep');
const baseUri = `${protocol}://${host}:${port}/${base_path}`;
//const {splitInputToNodes,aggregateInput} = require('./input-parser');
class Runner {
    constructor() {

    }
    async init(options) {
        this._options = options;
    }

    async parse(jobId, nodeName) {
        try {
            const pipeline = await this._getStoredExecution(jobId);
            const { successors, predecessors } = this._createGraphAndFindRelevantSuccessorsAndPredecessors(pipeline.data, nodeName);
            const flattenSuccessors = this._flattenSuccessors(successors, nodeName);
            const flattenPredecessors = this._flattenPredecessors(predecessors, nodeName);
            const subPipeline = this._createSubPipeline(flattenSuccessors, pipeline.data, jobId);
            const metadataFromPredecessors = await this._collectMetaDataFromPredecessors(jobId, flattenPredecessors, pipeline.date);
            const mergedPipeline = this._mergeSubPipelineWithMetadata(subPipeline, flattenPredecessors, metadataFromPredecessors);
            log.debug(`new pipeline sent for running: ${JSON.stringify(mergedPipeline)} `)
            return mergedPipeline;

        } catch (error) {
            log.error(`fail to parse ${jobId} pipeline for caching on nodeName ${nodeName}
             errorMessage: ${error.message}, stack: ${error.stack}`, { component: componentName.RUNNER })
        }
    }

    _mergeSubPipelineWithMetadata(subPipeline, flattenPredecessors, metadataFromSuccessors) {
        subPipeline.nodes.forEach(n => {
            const dependentNodes = splitInputToNodes(n.input, flattenPredecessors);
            //finish adding caching
            if (dependentNodes) {
                n.parentOutput = [];
                dependentNodes.forEach(dn => {
                    const metadata = metadataFromSuccessors.find(ms => ms.id === dn);
                    if (metadata) {
                        n.parentOutput.push(...metadata.metadata);
                    }
                    else {
                        log.error(`couldent find any matched caching object for node dependency ${dn}`, { componentName: componentName.RUNNER });
                    }
                })
            }
        })
        return subPipeline;
    }
    _createSubPipeline(flattenSuccessors, pipeline, jobId) {

        const uuidSuffix = uuidv4().split('-')[0]
        //   const flattenSuccessors = this._flattenSuccessors(parentSuccessors);
        const deepPipelineExecution = cloneDeep(pipeline);
        deepPipelineExecution.name = `${pipeline.name}:${uuidSuffix}`
        deepPipelineExecution.nodes = [];
        flattenSuccessors.forEach(s => {
            const node = pipeline.nodes.find(n => n.nodeName === s);
            if (node) {
                deepPipelineExecution.nodes.push(node)
            }
        })
        return deepPipelineExecution;
    }

    _flattenSuccessors(parentSuccessors, nodeName) {
        const flatten = new Set();
        flatten.add(nodeName)
        if (parentSuccessors) {
            parentSuccessors.forEach(s => s.successors.forEach(childSuccessor => {
                if (!flatten.has(childSuccessor)) {
                    flatten.add(childSuccessor);
                }
            }))
        }

        return [...flatten];
    }

    _flattenPredecessors(parentPredecessors, nodeName) {
        const flatten = new Set();
        flatten.add(nodeName)
        if (parentPredecessors) {
            parentPredecessors.forEach(p => p.predecessors.forEach(childPredecessor => {
                if (!flatten.has(childPredecessor)) {
                    flatten.add(childPredecessor);
                }
            }))
        }

        return [...flatten];
    }
    async _getStoredExecution(jobId) {
        try {
            const path = await storageManager.listExecution({ jobId });
            return await storageManager.get(path[0])

        } catch (error) {
            log.error(`fail to get description from custom resource ${error}`, { component: componentName.RUNNER })
        }

    }

    _createGraphAndFindRelevantSuccessorsAndPredecessors(pipeline, nodeName) {
        const builtGraph = new NodesMap(pipeline.nodes);
        return {
            successors: builtGraph.getAllSuccessors(nodeName),
            predecessors: builtGraph.getAllPredecessors(nodeName)
        };
    }

    async  _collectMetaDataFromPredecessors(jobId, flattenPredecessors, date) {
        let metadata = null;
        try {
            metadata = await Promise.all(flattenPredecessors.map(async p => ({
                id: p,
                metadata: await this._getMetaDataFromStorageAndCreateDescriptior(jobId, p, date)
            })))


        } catch (error) {
            log.error(`error on getting metadata from custom storage ${error}`);
        }
        return metadata;
    }

    async _getMetaDataFromStorageAndCreateDescriptior(jobId, nodeName, date) {
        try {
            const metadataPathList = await storageManager.listMetadata({ date, jobId, nodeName });
            const metadataList = await Promise.all(metadataPathList.map(async path => {
                const metadata = await storageManager.get(path);
                return {
                    node: nodeName,
                    type: 'waitNode',
                    result: metadata.result
                }
            }))

            return metadataList;
        } catch (error) {
            log.error(`fail to get metadata from custom resource ${error}`, { component: componentName.RUNNER })
        }
        // const stub = [{
        //     node: nodeName,
        //     type: 'WAIT_NODE',
        //     result: {
        //         "metadata": {
        //             "yellow": { type: "array", size: 5 }
        //         },
        //         "storageInfo": {
        //             "Key": "yellow:yellow-alg:bde23282-4a20-4a13-9d5c-a1e9cd4a696a",
        //             "Bucket": "batch-5b0b25a1-5364-4bd6-b9b0-126de5ed2227",
        //             "path": 'link_to_data'
        //         }
        //     }
        // }]
        // return stub;
    }
}


module.exports = new Runner;