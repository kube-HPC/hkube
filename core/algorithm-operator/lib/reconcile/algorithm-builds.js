const etcd = require('../helpers/etcd');
const { createBuildJobSpec } = require('../jobs/algorithm-builds');
const kubernetes = require('../helpers/kubernetes');
const { normalizeBuildJobs, normalizeSecret } = require('./normalize');

const _createBuildJob = async (jobDetails) => {
    const spec = createBuildJobSpec(jobDetails);
    await etcd.setBuild({ buildId: jobDetails.buildId, timestamp: Date.now(), progress: 5, status: 'creating' });
    await kubernetes.createJob({ spec });
};

// TODO: clean algorithm-builder k8s Jobs
const reconcile = async ({ builds, jobs, secret, versions, registry, options, resourcesMain, resourcesBuilder, algorithmBuilderResourcesEnable }) => {
    const normJobs = normalizeBuildJobs(jobs, j => !j.status.succeeded);
    const normSecret = normalizeSecret(secret);
    const added = builds.filter(a => !normJobs.find(d => d.buildId === a.buildId));
    await Promise.all(added.map(a => _createBuildJob({ buildId: a.buildId, secret: normSecret, versions, registry, options, resourcesMain, resourcesBuilder, algorithmBuilderResourcesEnable })));
};

module.exports = {
    reconcile
};
