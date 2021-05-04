const { uid } = require('@hkube/uid');
const log = require('@hkube/logger').GetLogFromContainer();
const { createDeploymentSpec } = require('../deployments/algorithm-queue');
const kubernetes = require('../helpers/kubernetes');
const jobProducer = require('../producer/jobs-producer');
const { findVersion } = require('../helpers/images');
const component = require('../consts/componentNames').ALGORITHM_QUEUE_RECONCILER;
const QueueActions = require('../consts/queue-actions');
const { normalizeDeployments, normalizeQueuesDiscovery, normalizeAlgorithms } = require('./normalize');
const CONTAINERS = require('../consts/containers');

const _createDeployment = async ({ queueId, options }) => {
    log.debug(`need to add new algorithm queue ${queueId} with details ${JSON.stringify(options, null, 2)}`, { component });
    const spec = createDeploymentSpec({ queueId, ...options });
    await kubernetes.createDeployment({ spec });
};

const _updateDeployment = async ({ deployment, options }) => {
    const { algorithmName } = deployment;
    log.debug(`need to add ${algorithmName} with details ${JSON.stringify(options, null, 2)}`, { component });
    const spec = createDeploymentSpec({ algorithmName, ...options });
    await kubernetes.updateDeployment({ spec });
};

const _deleteDeployment = async ({ queueId }) => {
    await kubernetes.deleteDeployment({ deploymentName: `${CONTAINERS.ALGORITHM_QUEUE}-${queueId}` });
};

const _findEmptyQueues = (queueToAlgorithms, normDeployments) => {
    const emptyQueues = Object.entries(queueToAlgorithms)
        .filter(([k, v]) => !v.algorithms.length
            && Date.now() - v.timestamp > 10000
            && normDeployments.find(d => d.queueId === k))
        .map(([k]) => k);
    return emptyQueues;
};

const _findAvailableQueues = (queueToAlgorithms, limit) => {
    const emptyQueues = Object.entries(queueToAlgorithms)
        .filter(([, v]) => v.algorithms.length < limit)
        .map(([k, v]) => ({ queueId: k, current: v.algorithms.length }));
    return emptyQueues;
};

const _findObsoleteAlgorithms = (algorithmsToQueue, normAlgorithms) => {
    const emptyQueues = Object.entries(algorithmsToQueue)
        .filter(([k]) => !normAlgorithms.find(a => k === a.name))
        .map(([k, v]) => ({ algorithmName: k, queueId: v }));
    return emptyQueues;
};

const reconcile = async ({ deployments, algorithms, discovery, versions, registry, clusterOptions, resources, options } = {}) => {
    const { limit } = options.algorithmQueueBalancer;
    const version = findVersion({ versions, repositoryName: CONTAINERS.ALGORITHM_QUEUE });
    const { algorithmsToQueue, queueToAlgorithms } = normalizeQueuesDiscovery(discovery);
    const normAlgorithms = normalizeAlgorithms(algorithms);
    const normDeployments = normalizeDeployments(deployments);
    const emptyQueues = _findEmptyQueues(queueToAlgorithms, normDeployments);
    const availableQueues = _findAvailableQueues(queueToAlgorithms, limit);
    const requiredDeployments = Math.ceil(normAlgorithms.length / limit);
    const missingDeployments = requiredDeployments - normDeployments.length;
    const updated = normDeployments.filter(d => d.image.tag !== version);
    const addAlgorithms = normAlgorithms.filter(a => !algorithmsToQueue[a.name]);
    const removeAlgorithms = _findObsoleteAlgorithms(algorithmsToQueue, normAlgorithms);

    const createPromises = [];
    const reconcileResult = {};

    for (let i = 0; i < missingDeployments; i += 1) {
        await _createDeployment({ queueId: uid({ length: 12 }), options: { versions, registry, clusterOptions, resources, options } }); // eslint-disable-line
    }

    // match algorithms to available queues
    if (availableQueues.length && addAlgorithms.length) {
        for (let i = 0; i < addAlgorithms.length; i += 1) {
            const availableQueue = availableQueues[0];
            if (!availableQueue) {
                break;
            }
            const { queueId } = availableQueue;
            const algorithmName = addAlgorithms[i].name;
            await jobProducer.createJob({ queueId, action: QueueActions.ADD, algorithmName }); // eslint-disable-line
            availableQueue.current += 1;
            if (availableQueue.current === limit) {
                availableQueues.shift();
            }
        }
    }

    for (const algorithm of removeAlgorithms) {
        const { queueId, algorithmName } = algorithm;
        await jobProducer.createJob({ queueId, action: QueueActions.REMOVE, algorithmName }); // eslint-disable-line
    }

    for (const queueId of emptyQueues) {
        createPromises.push(_deleteDeployment({ queueId }));
    }

    for (const deployment of updated) {
        createPromises.push(_updateDeployment({ deployment, options: { versions, registry, clusterOptions, resources, options } }));
    }

    await Promise.all(createPromises);
    return reconcileResult;
};

module.exports = {
    reconcile
};
