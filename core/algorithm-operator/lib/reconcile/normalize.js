const objectPath = require('object-path');
const { parseImageName } = require('@hkube/kubernetes-client').utils;

const normalizeQueuesDeployments = (deploymentsRaw) => {
    if (deploymentsRaw == null) {
        return [];
    }
    const deployments = deploymentsRaw.body.items.map(j => ({
        name: j.metadata.name,
        queueId: j.metadata.labels['queue-id'],
        image: parseImageName(objectPath.get(j, 'spec.template.spec.containers.0.image')),
        imageFull: objectPath.get(j, 'spec.template.spec.containers.0.image'),
        env: objectPath.get(j, 'spec.template.spec.containers.0.env', [])
    }));
    return deployments;
};

const normalizeDebugDeployments = (deploymentsRaw) => {
    if (deploymentsRaw == null) {
        return [];
    }
    const deployments = deploymentsRaw.body.items.map(j => ({
        name: j.metadata.name,
        algorithmName: j.metadata.labels['algorithm-name'],
        image: parseImageName(objectPath.get(j, 'spec.template.spec.containers.0.image')),
        imageFull: objectPath.get(j, 'spec.template.spec.containers.0.image'),
        env: objectPath.get(j, 'spec.template.spec.containers.0.env', [])
    }));
    return deployments;
};

const normalizeQueuesDiscovery = (discovery) => {
    if (!discovery) {
        return [];
    }
    const algorithmsToQueue = Object.create(null);
    const queueToAlgorithms = Object.create(null);
    const duplicateAlgorithms = [];

    discovery.forEach((d) => {
        if (!queueToAlgorithms[d.queueId]) {
            queueToAlgorithms[d.queueId] = { count: 0, active: d.active, timestamp: d.timestamp };
        }
        d.algorithms?.forEach((a) => {
            if (algorithmsToQueue[a]) {
                duplicateAlgorithms.push({ queueId: d.queueId, algorithmName: a });
            }
            else {
                algorithmsToQueue[a] = d.queueId;
                queueToAlgorithms[d.queueId].count += 1;
            }
        });
    });
    return { algorithmsToQueue, queueToAlgorithms, duplicateAlgorithms };
};

const normalizeServices = (servicesSpec) => {
    if (!servicesSpec?.body?.items) {
        return [];
    }
    const services = servicesSpec.body.items.map(s => ({
        algorithmName: s.metadata.labels['algorithm-name']
    }));
    return services;
};

const normalizeAlgorithms = (algorithmsRaw) => {
    if (algorithmsRaw == null) {
        return [];
    }
    return algorithmsRaw.filter(a => a.options && !a.options.pending);
};

const _tryParseTime = (timeString) => {
    if (!timeString) {
        return null;
    }
    try {
        const date = new Date(timeString);
        return date.getTime();
    }
    catch (error) {
        return null;
    }
};

const normalizeBuildJobs = (jobsRaw, predicate = () => true) => {
    if (!jobsRaw || !jobsRaw.body || !jobsRaw.body.items) {
        return [];
    }
    const jobs = jobsRaw.body.items
        .filter(predicate)
        .map(j => ({
            name: j.metadata.name,
            buildId: j.metadata.labels['build-id'],
            active: j.status.active === 1,
            startTime: _tryParseTime(j.status.startTime)
        }));
    return jobs;
};

const normalizeBoardDeployments = (deploymentsRaw) => {
    if (deploymentsRaw == null) {
        return [];
    }
    const deployments = deploymentsRaw.body.items.map(j => ({
        name: j.metadata.name,
        boardReference: j.metadata.labels['board-id'],
        image: parseImageName(objectPath.get(j, 'spec.template.spec.containers.0.image'))
    }));
    return deployments;
};

const normalizeSecret = (secret) => {
    if (!secret || !secret.body) {
        return {};
    }
    return secret.body;
};

const normalizeDrivers = (drivers) => {
    if (!drivers) {
        return [];
    }
    const driversArray = drivers.map((d) => {
        return {
            id: d.driverId,
            idle: d.idle,
            paused: d.paused,
            podName: d.podName,
            jobs: d.jobs?.length || 0
        };
    });
    return driversArray;
};

const normalizeDriversRequests = (requests, name) => {
    if (requests == null || requests.length === 0 || requests[0].data == null) {
        return 0;
    }
    return requests[0].data.filter(r => r.name === name).length;
};

const normalizeDriversJobs = (jobsRaw, predicate = () => true) => {
    if (!jobsRaw || !jobsRaw.body || !jobsRaw.body.items) {
        return [];
    }
    const jobs = jobsRaw.body.items
        .filter(predicate)
        .map(j => ({
            name: j.metadata.name,
            active: j.status.active === 1
        }));
    return jobs;
};

/**
 * calculate the desired drivers amount
 */
const normalizeDriversAmount = (drivers, requests, settings) => {
    const { minAmount, maxAmount, concurrency } = settings;
    const current = drivers.length;
    const available = drivers.map(d => concurrency - d.jobs).reduce((a, b) => a + b, 0);
    let amount = 0;
    if (current === 0) {
        amount = minAmount;
    }
    else if (requests > available) {
        amount = (requests - available) / concurrency;
        amount = current + Math.ceil(amount);
        amount = Math.min(amount, maxAmount);
    }
    return amount;
};

module.exports = {
    normalizeQueuesDeployments,
    normalizeDebugDeployments,
    normalizeQueuesDiscovery,
    normalizeServices,
    normalizeAlgorithms,
    normalizeBuildJobs,
    normalizeBoardDeployments,
    normalizeSecret,
    normalizeDrivers,
    normalizeDriversRequests,
    normalizeDriversJobs,
    normalizeDriversAmount
};
