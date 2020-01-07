const { boardStatuses } = require('@hkube/consts');
const etcd = require('../helpers/etcd');
const { createKindsSpec } = require('../deployments/tensorboard');
const kubernetes = require('../helpers/kubernetes');
const { normalizeBoardDeployments } = require('./normalize');
const deploymentType = require('../consts/DeploymentTypes').BOARD;
const _createBoardDeployment = async (deploymentDetails) => {
    const { versions, registry, clusterOptions, options, board } = deploymentDetails;
    const { boardId, logDir } = board;
    const { deploymentSpec, serviceSpec, ingressSpec } = createKindsSpec({ boardId, logDir, versions, registry, clusterOptions, options });
    await kubernetes.deployExposedPod({ deploymentSpec, ingressSpec, serviceSpec, name: boardId }, deploymentType);
    board.status = boardStatuses.CREATING;
    board.timestamp = Date.now();
    await etcd.updateTensorboard(board);
};

const reconcile = async ({ boards, deployments, versions, registry, clusterOptions, options }) => {
    const normDeployments = normalizeBoardDeployments(deployments);
    const pending = boards.filter(b => b.status === boardStatuses.PENDING);
    const added = pending.filter(a => !normDeployments.find(d => d.boardId === a.boardId));
    const removed = normDeployments.filter(a => !boards.find(d => d.boardId === a.boardId));
    await Promise.all(added.map(a => _createBoardDeployment({ board: a, versions, registry, clusterOptions, options })));
    await Promise.all(removed.map(a => kubernetes.deleteExposedDeployment(a.boardId, deploymentType)));
};

module.exports = {
    reconcile
};
