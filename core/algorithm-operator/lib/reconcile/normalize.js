const objectPath = require('object-path');
const { parseImageName } = require('@hkube/kubernetes-client').utils;

const normalizeDeployments = (deploymentsRaw) => {
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

module.exports = {
    normalizeDeployments,
    normalizeAlgorithms,
    normalizeBuildJobs,
    normalizeBoardDeployments,
    normalizeSecret
};
