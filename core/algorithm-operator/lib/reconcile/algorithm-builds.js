const db = require('../helpers/db');
const { createBuildJobSpec } = require('../jobs/algorithm-builds');
const kubernetes = require('../helpers/kubernetes');
const buildStatus = require('../consts/buildStatus');
const { normalizeBuildJobs, normalizeSecret } = require('./normalize');

const _createBuildJob = async (jobDetails) => {
    const spec = createBuildJobSpec(jobDetails);
    await db.setBuild({ buildId: jobDetails.buildId, timestamp: Date.now(), progress: 5, status: buildStatus.CREATING });
    await kubernetes.createJob({ spec });
};

const reconcile = async ({ builds, jobs, secret, versions, registry, options, clusterOptions }) => {
    const normJobs = normalizeBuildJobs(jobs, j => !j.status.succeeded);
    const normSecret = normalizeSecret(secret);
    const pending = builds.filter(b => b.status === buildStatus.PENDING);
    const stopped = builds.filter(b => b.status === buildStatus.STOPPED);
    const added = pending.filter(a => !normJobs.find(d => d.buildId === a.buildId));
    const removed = normJobs.filter(a => stopped.find(d => d.buildId === a.buildId));
    await Promise.all(added.map(a => _createBuildJob({ buildId: a.buildId, secret: normSecret, versions, registry, options, clusterOptions })));
    await Promise.all(removed.map(a => kubernetes.deleteJob(a.name)));
};

module.exports = {
    reconcile
};
