const objectPath = require('object-path');
const { parseImageName } = require('../helpers/images');

const normalizeDeployments = (deploymentsRaw) => {
    if (deploymentsRaw == null) {
        return [];
    }
    const deployments = deploymentsRaw.body.items.map(j => ({
        name: j.metadata.name,
        algorithmName: j.metadata.labels['algorithm-name'],
        image: parseImageName(objectPath.get(j, 'spec.template.spec.containers.0.image'))
    }));
    return deployments;
};

const normalizeAlgorithms = (algorithmsRaw) => {
    if (algorithmsRaw == null) {
        return [];
    }
    return algorithmsRaw.filter(a => !a.options.pending);
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

module.exports = {
    normalizeDeployments,
    normalizeAlgorithms,
    normalizeBuildJobs
};
