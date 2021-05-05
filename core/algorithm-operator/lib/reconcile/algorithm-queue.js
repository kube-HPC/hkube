const { uid } = require('@hkube/uid');
const log = require('@hkube/logger').GetLogFromContainer();
const orderBy = require('lodash.orderby');
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
        .filter(([k, v]) => !v.count
            && Date.now() - v.timestamp > 30000
            && normDeployments.find(d => d.queueId === k))
        .map(([k]) => k);
    return emptyQueues;
};

const _findAvailableQueues = (queueToAlgorithms, limit) => {
    const emptyQueues = Object.entries(queueToAlgorithms)
        .filter(([, v]) => v.count < limit)
        .map(([k, v]) => ({ queueId: k, count: v.count }));
    const queues = orderBy(emptyQueues, 'count');
    return queues;
};

const _findObsoleteAlgorithms = (algorithmsToQueue, normAlgorithms) => {
    const emptyQueues = Object.entries(algorithmsToQueue)
        .filter(([k]) => !normAlgorithms.find(a => k === a.name))
        .map(([k, v]) => ({ algorithmName: k, queueId: v }));
    return emptyQueues;
};

const _matchAlgorithmsToQueue = async (algorithms, queues, limit) => {
    if (algorithms.length && algorithms.length) {
        for (let i = 0; i < algorithms.length; i += 1) {
            const availableQueue = queues[0];
            if (!availableQueue) {
                break;
            }
            const { queueId } = availableQueue;
            const algorithmName = algorithms[i].name;
            await jobProducer.createJob({ queueId, action: QueueActions.ADD, algorithmName }); // eslint-disable-line
            availableQueue.count += 1;
            if (availableQueue.count === limit) {
                queues.shift();
            }
        }
    }
};

const _removeAlgorithmsFromQueue = async (algorithms) => {
    for (const algorithm of algorithms) {
        const { queueId, algorithmName } = algorithm;
        await jobProducer.createJob({ queueId, action: QueueActions.REMOVE, algorithmName }); // eslint-disable-line
    }
};

const _removeDuplicatesAlgorithms = async (algorithms) => {
    if (algorithms.length) {
        log.warning(`found ${algorithms.length} duplicates algorithms`, { component });
        await _removeAlgorithmsFromQueue(algorithms);
    }
};

const _createQueueId = () => {
    return uid({ length: 12 });
};

const reconcile = async ({ deployments, algorithms, discovery, versions, registry, clusterOptions, resources, options } = {}) => {
    const { limit } = options.algorithmQueueBalancer;
    const version = findVersion({ versions, repositoryName: CONTAINERS.ALGORITHM_QUEUE });
    const { algorithmsToQueue, queueToAlgorithms, duplicateAlgorithms } = normalizeQueuesDiscovery(discovery);
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
        const queueId = _createQueueId();
        await _createDeployment({ queueId, options: { versions, registry, clusterOptions, resources, options } }); // eslint-disable-line
    }

    await _matchAlgorithmsToQueue(addAlgorithms, availableQueues, limit);
    await _removeAlgorithmsFromQueue(removeAlgorithms);
    await _removeDuplicatesAlgorithms(duplicateAlgorithms);

    for (const queueId of emptyQueues) {
        createPromises.push(_deleteDeployment({ queueId }));
    }

    for (const deployment of updated) {
        createPromises.push(_updateDeployment({ deployment, options: { versions, registry, clusterOptions, resources, options } }));
    }

    await Promise.all(createPromises);
    return reconcileResult;
};

const reconcileDevMode = async ({ algorithms, discovery, options } = {}) => {
    const { limit } = options.algorithmQueueBalancer;
    const { algorithmsToQueue, queueToAlgorithms } = normalizeQueuesDiscovery(discovery);
    const normAlgorithms = normalizeAlgorithms(algorithms);
    const availableQueues = _findAvailableQueues(queueToAlgorithms, limit);
    const addAlgorithms = normAlgorithms.filter(a => !algorithmsToQueue[a.name]);
    const removeAlgorithms = _findObsoleteAlgorithms(algorithmsToQueue, normAlgorithms);

    await _matchAlgorithmsToQueue(addAlgorithms, availableQueues, limit);
    await _removeAlgorithmsFromQueue(removeAlgorithms);
};

module.exports = {
    reconcile,
    reconcileDevMode
};
