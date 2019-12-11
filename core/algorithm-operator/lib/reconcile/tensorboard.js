const etcd = require('../helpers/etcd');
const { createKindsSpec } = require('../deployments/tensorboard');
const kubernetes = require('../helpers/kubernetes');
const { normalizeBoardDeployments, normalizeSecret } = require('./normalize');

const STATUS = {
    RUNNING: 'running',
    PENDING: 'pending',
    STOPPED: 'stopped'
};

const _createBoardJob = async (jobDetails) => {
    const { deploymentSpec, serviceSpec, ingressSpec } = createKindsSpec(jobDetails);
    await kubernetes.deployExposedPod({ deploymentSpec, ingressSpec, serviceSpec, name: jobDetails.boardId }, 'board');
    await etcd.setTensorboard({ boardId: jobDetails.boardId, timestamp: Date.now(), progress: 5, status: STATUS.RUNNING });
};

const reconcile = async ({ boards, jobs, secret, versions, registry, clusterOptions, options }) => {
    const normJobs = normalizeBoardDeployments(jobs, j => !j.status.succeeded);
    const normSecret = normalizeSecret(secret);
    const pending = boards.filter(b => b.status === STATUS.PENDING);
    const stopped = boards.filter(b => b.status === STATUS.STOPPED);
    const added = pending.filter(a => !normJobs.find(d => d.boardId === a.boardId));
    const removed = normJobs.filter(a => stopped.find(d => d.boardId === a.boardId));
    await Promise.all(added.map(a => _createBoardJob({ boardId: a.boardId, logDir: a.logDir, secret: normSecret, versions, registry, clusterOptions, options })));
    await Promise.all(removed.map(a => kubernetes.deleteExpoesedJob(a.name, 'board')));
};

module.exports = {
    reconcile
};
