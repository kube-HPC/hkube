const etcd = require('../helpers/etcd');
const { createKindsSpec } = require('../deployments/tensorboard');
const kubernetes = require('../helpers/kubernetes');
const { normalizeBoardDeployments, normalizeSecret } = require('./normalize');
const deploynetType = require('../consts/DeploymentTypes').BOARD;

const STATUS = {
    RUNNING: 'running',
    PENDING: 'pending',
    STOPPED: 'stopped'
};

const _createBoardDeploynent = async (jobDetails) => {
    const { deploymentSpec, serviceSpec, ingressSpec } = createKindsSpec(jobDetails);
    await kubernetes.deployExposedPod({ deploymentSpec, ingressSpec, serviceSpec, name: jobDetails.boardId }, deploynetType);
    await etcd.setTensorboard({ boardId: jobDetails.boardId, timestamp: Date.now(), progress: 5, status: STATUS.RUNNING });
};

const reconcile = async ({ boards, deployments, secret, versions, registry, clusterOptions, options }) => {
    const normDeploynets = normalizeBoardDeployments(deployments);
    const normSecret = normalizeSecret(secret);
    const pending = boards.filter(b => b.status === STATUS.PENDING);
    const stopped = boards.filter(b => b.status === STATUS.STOPPED);
    const added = pending.filter(a => !normDeploynets.find(d => d.boardId === a.boardId));
    const removed = normDeploynets.filter(a => stopped.find(d => d.boardId === a.boardId));
    await Promise.all(added.map(a => _createBoardDeploynent({ boardId: a.boardId, logDir: a.logDir, secret: normSecret, versions, registry, clusterOptions, options })));
    await Promise.all(removed.map(a => kubernetes.deleteExpoesedDeploymet(a.boardId, deploynetType)));
};

module.exports = {
    reconcile
};
