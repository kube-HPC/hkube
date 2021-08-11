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
const jobsMessageQueue = require('../helpers/jobs-message-queue');
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

const _deleteDeployments = async ({ queues, normDeployments }) => {
    const inActiveQueues = Object.entries(queues)
        .filter(([k, v]) => !v.active && normDeployments.find(d => d.queueId === k))
        .map(([k]) => k);
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
            await etcd.sendAlgorithmQueueAction({ queueId, action: QueueActions.ADD, algorithmName, timestamp: Date.now() }); // eslint-disable-line
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
        await etcd.sendAlgorithmQueueAction({ queueId, action: QueueActions.REMOVE, algorithmName, timestamp: Date.now() }); // eslint-disable-line
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

const _addDeployments = async ({ limit, availableQueues, algorithms, versions, registry, clusterOptions, resources, options }) => {
    const missingDeployments = Math.ceil(algorithms / limit);
    if (availableQueues.length === 0 && missingDeployments > 0) {
        log.info(`need to add ${missingDeployments} algorithm-queue deployments`, { component });
        for (let i = 0; i < missingDeployments; i += 1) {
            const queueId = _createQueueId();
            await _createDeployment({ queueId, options: { versions, registry, clusterOptions, resources, options } }); // eslint-disable-line
        }
    }
};

const isRequired = ({ alg, algorithmsToQueue, waitingCount, algorithmQueues, maxIdleTime }) => {
    const isMissing = !algorithmsToQueue[alg.name];
    const isQueued = waitingCount[alg.name] > 0;
    const isActive = Date.now() - algorithmQueues[alg.name] < maxIdleTime;
    return isMissing && (isQueued || isActive);
};

const reconcile = async ({ deployments, algorithms, discovery, versions, registry, clusterOptions, resources, options, devMode } = {}) => {
    const { limit, maxIdleTime } = options.algorithmQueueBalancer;
    const { algorithmsToQueue, queueToAlgorithms, duplicateAlgorithms } = normalizeQueuesDiscovery(discovery);
    const normAlgorithms = normalizeAlgorithms(algorithms);
    const normDeployments = normalizeQueuesDeployments(deployments);
    const availableQueues = _findAvailableQueues({ queueToAlgorithms, limit });
    const removeAlgorithms = _findObsoleteAlgorithms({ algorithmsToQueue, normAlgorithms });
    const waitingCount = await jobsMessageQueue.getWaitingCount(algorithms);
    const algorithmQueues = await etcd.getAlgorithmQueuesList();
    const requiredAlgorithms = normAlgorithms.filter(a => isRequired({ alg: a, algorithmsToQueue, waitingCount, algorithmQueues, maxIdleTime }));

    if (!devMode) {
        await _addDeployments({ limit, availableQueues, algorithms: requiredAlgorithms.length, versions, registry, clusterOptions, resources, options });
        await _updateDeployments({ normDeployments, options: { versions, registry, clusterOptions, resources, options } });
        await _deleteDeployments({ queues: queueToAlgorithms, normDeployments });
    }
    await _matchAlgorithmsToQueue({ algorithms: requiredAlgorithms, queues: availableQueues, limit });
    await _removeAlgorithmsFromQueue({ algorithms: removeAlgorithms });
    await _removeDuplicatesAlgorithms({ algorithms: duplicateAlgorithms });
};

const reconcileDevMode = ({ algorithms, discovery, options } = {}) => {
    return reconcile({ algorithms, discovery, options, devMode: true });
};

module.exports = {
    reconcile,
    reconcileDevMode
};
