const { uid } = require('@hkube/uid');
const log = require('@hkube/logger').GetLogFromContainer();
const orderBy = require('lodash.orderby');
const { createDeploymentSpec } = require('../deployments/algorithm-queue');
const kubernetes = require('../helpers/kubernetes');
const etcd = require('../helpers/etcd');
const { findVersion } = require('../helpers/images');
const component = require('../consts/componentNames').ALGORITHM_QUEUE_RECONCILER;
const QueueActions = require('../consts/queue-actions');
const { normalizeQueuesDeployments, normalizeQueuesDiscovery, normalizeAlgorithms } = require('./normalize');
const CONTAINERS = require('../consts/containers');

const _createDeployment = async ({ queueId, options }) => {
    log.debug(`need to add new algorithm queue deployment ${queueId} with details ${JSON.stringify(options, null, 2)}`, { component });
    const spec = createDeploymentSpec({ queueId, ...options });
    await kubernetes.createDeployment({ spec });
};

const _updateDeployment = async ({ queueId, options }) => {
    log.debug(`need to update algorithm queue deployment  with details  ${queueId} ${JSON.stringify(options, null, 2)}`, { component });
    const spec = createDeploymentSpec({ queueId, ...options });
    await kubernetes.updateDeployment({ spec });
};

const _deleteDeployment = async ({ queueId }) => {
    await kubernetes.deleteDeployment({ deploymentName: `${CONTAINERS.ALGORITHM_QUEUE}-${queueId}` });
};

const _deleteDeployments = async ({ queues }) => {
    const inActiveQueues = Object.entries(queues).filter(([, v]) => !v.active).map(([k]) => k);
    for (const queueId of inActiveQueues) {
        await _deleteDeployment({ queueId }); // eslint-disable-line
    }
};

const _updateDeployments = async ({ normDeployments, options }) => {
    const version = findVersion({ versions: options.versions, repositoryName: CONTAINERS.ALGORITHM_QUEUE });
    const updated = normDeployments.filter(d => d.image.tag !== version);
    for (const deployment of updated) {
        await _updateDeployment({ queueId: deployment.queueId, options }); // eslint-disable-line
    }
};

const _findAvailableQueues = ({ queueToAlgorithms, limit }) => {
    const queues = Object.entries(queueToAlgorithms)
        .filter(([, v]) => v.count < limit)
        .map(([k, v]) => ({ queueId: k, count: v.count }));
    return queues;
};

const _findObsoleteAlgorithms = ({ algorithmsToQueue, normAlgorithms }) => {
    const emptyQueues = Object.entries(algorithmsToQueue)
        .filter(([k]) => !normAlgorithms.find(a => k === a.name))
        .map(([k, v]) => ({ algorithmName: k, queueId: v }));
    return emptyQueues;
};

const _matchAlgorithmsToQueue = async ({ algorithms, queues, limit }) => {
    if (algorithms.length && queues.length) {
        for (let i = 0; i < algorithms.length; i += 1) {
            const sortedQueues = orderBy(queues, 'count');
            const availableQueue = sortedQueues[0];
            if (!availableQueue) {
                break;
            }
            const { queueId } = availableQueue;
            const algorithmName = algorithms[i].name;
            await etcd.sendAlgorithmQueueAction({ queueId, action: QueueActions.ADD, algorithmName }); // eslint-disable-line
            availableQueue.count += 1;
            if (availableQueue.count === limit) {
                sortedQueues.shift();
            }
        }
    }
};

const _removeAlgorithmsFromQueue = async ({ algorithms }) => {
    for (const algorithm of algorithms) {
        const { queueId, algorithmName } = algorithm;
        await etcd.sendAlgorithmQueueAction({ queueId, action: QueueActions.REMOVE, algorithmName }); // eslint-disable-line
    }
};

const _removeDuplicatesAlgorithms = async ({ algorithms }) => {
    if (algorithms.length) {
        log.warning(`found ${algorithms.length} duplicates algorithms`, { component });
        await _removeAlgorithmsFromQueue({ algorithms });
    }
};

const _createQueueId = () => {
    return uid({ length: 12 });
};

const _addDeployments = async ({ limit, algorithms, normDeployments, versions, registry, clusterOptions, resources, options }) => {
    if (limit > 0) {
        const requiredDeployments = Math.ceil(algorithms / limit);
        const missingDeployments = requiredDeployments - normDeployments.length;
        if (missingDeployments > 0) {
            log.info(`need to add ${missingDeployments} deployments`, { component });
            for (let i = 0; i < missingDeployments; i += 1) {
                const queueId = _createQueueId();
                await _createDeployment({ queueId, options: { versions, registry, clusterOptions, resources, options } }); // eslint-disable-line
            }
        }
    }
    else {
        log.throttle.warning(`invalid deployments queue limit "${limit}"`, { component });
    }
};

const reconcile = async ({ deployments, algorithms, discovery, versions, registry, clusterOptions, resources, options } = {}) => {
    const { limit } = options.algorithmQueueBalancer;
    const { algorithmsToQueue, queueToAlgorithms, duplicateAlgorithms } = normalizeQueuesDiscovery(discovery);
    const normAlgorithms = normalizeAlgorithms(algorithms);
    const normDeployments = normalizeQueuesDeployments(deployments);
    const availableQueues = _findAvailableQueues({ queueToAlgorithms, limit });
    const addAlgorithms = normAlgorithms.filter(a => !algorithmsToQueue[a.name]);
    const removeAlgorithms = _findObsoleteAlgorithms({ algorithmsToQueue, normAlgorithms });

    await _addDeployments({ limit, algorithms: normAlgorithms.length, normDeployments, versions, registry, clusterOptions, resources, options });
    await _matchAlgorithmsToQueue({ algorithms: addAlgorithms, queues: availableQueues, limit });
    await _removeAlgorithmsFromQueue({ algorithms: removeAlgorithms });
    await _removeDuplicatesAlgorithms({ algorithms: duplicateAlgorithms });
    await _deleteDeployments({ queues: queueToAlgorithms });
    await _updateDeployments({ normDeployments, options: { versions, registry, clusterOptions, resources, options } });
};

const reconcileDevMode = async ({ algorithms, discovery, options } = {}) => {
    const { limit } = options.algorithmQueueBalancer;
    const { algorithmsToQueue, queueToAlgorithms } = normalizeQueuesDiscovery(discovery);
    const normAlgorithms = normalizeAlgorithms(algorithms);
    const availableQueues = _findAvailableQueues({ queueToAlgorithms, limit });
    const addAlgorithms = normAlgorithms.filter(a => !algorithmsToQueue[a.name]);
    const removeAlgorithms = _findObsoleteAlgorithms({ algorithmsToQueue, normAlgorithms });

    await _matchAlgorithmsToQueue({ algorithms: addAlgorithms, queues: availableQueues, limit });
    await _removeAlgorithmsFromQueue({ algorithms: removeAlgorithms });
};

module.exports = {
    reconcile,
    reconcileDevMode
};
