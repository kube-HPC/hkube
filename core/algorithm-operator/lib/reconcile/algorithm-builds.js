const etcd = require('../helpers/etcd');
const { createBuildJobSpec } = require('../jobs/algorithm-builds');
const kubernetes = require('../helpers/kubernetes');
const { normalizeBuildJobs, normalizeSecret } = require('./normalize');

const STATUS = {
    CREATING: 'creating',
    PENDING: 'pending',
    STOPPED: 'stopped'
};

const _createBuildJob = async (jobDetails) => {
    const spec = createBuildJobSpec(jobDetails);
    await etcd.setBuild({ buildId: jobDetails.buildId, timestamp: Date.now(), progress: 5, status: STATUS.CREATING });
    await kubernetes.createJob({ spec });
};

const reconcile = async ({ builds, jobs, secret, versions, registry, options }) => {
    const normJobs = normalizeBuildJobs(jobs, j => !j.status.succeeded);
    const normSecret = normalizeSecret(secret);
    const pending = builds.filter(b => b.status === STATUS.PENDING);
    const stopped = builds.filter(b => b.status === STATUS.STOPPED);
    const added = pending.filter(a => !normJobs.find(d => d.buildId === a.buildId));
    const removed = normJobs.filter(a => stopped.find(d => d.buildId === a.buildId));
    await Promise.all(added.map(a => _createBuildJob({ buildId: a.buildId, secret: normSecret, versions, registry, options })));
    await Promise.all(removed.map(a => kubernetes.deleteJob(a.name)));
};

module.exports = {
    reconcile
};
