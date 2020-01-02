const etcd = require('../helpers/etcd');
const { createKindsSpec } = require('../deployments/tensorboard');
const kubernetes = require('../helpers/kubernetes');
const { normalizeBoardDeployments, normalizeSecret } = require('./normalize');
const deploymentType = require('../consts/DeploymentTypes').BOARD;
const { STATUS } = require('../consts/tenosrboard-status');


const _createBoardDeployment = async (jobDetails) => {
    const { deploymentSpec, serviceSpec, ingressSpec } = createKindsSpec(jobDetails);
    await kubernetes.deployExposedPod({ deploymentSpec, ingressSpec, serviceSpec, name: jobDetails.boardId }, deploymentType);
    await etcd.setTensorboard({ boardId: jobDetails.boardId, timestamp: Date.now(), progress: 5, status: STATUS.CREATING });
};

const reconcile = async ({ boards, deployments, secret, versions, registry, clusterOptions, options }) => {
    const normDeployments = normalizeBoardDeployments(deployments);
    const normSecret = normalizeSecret(secret);
    const pending = boards.filter(b => b.status === STATUS.PENDING);
    const added = pending.filter(a => !normDeployments.find(d => d.boardId === a.boardId));
    const removed = normDeployments.filter(a => !boards.find(d => d.boardId === a.boardId));
    await Promise.all(added.map(a => _createBoardDeployment({ boardId: a.boardId, logDir: a.logDir, secret: normSecret, versions, registry, clusterOptions, options })));
    await Promise.all(removed.map(a => kubernetes.deleteExposedDeployment(a.boardId, deploymentType)));
};

module.exports = {
    reconcile
};
