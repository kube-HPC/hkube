const log = require('@hkube/logger').GetLogFromContainer();
const { devenvStatuses, devenvTypes } = require('@hkube/consts');
const handlers = require('./devenvs');
const db = require('../helpers/db');

const reconcile = async ({ devenvs, deployments, versions, registry, clusterOptions, boardTimeOut, options }) => {
    // const normDeployments = normalizeBoardDeployments(deployments);
    // const pending = boards.filter(b => b.status === boardStatuses.PENDING);
    // const added = pending.filter(a => !normDeployments.find(d => d.boardReference === a.boardReference));
    // const now = Date.now();
    // const timedOut = boards.filter(b => ((b.startTime + boardTimeOut) < now));
    // await Promise.all(timedOut.map(board => (db.deleteTensorboard(board))));
    // const boardsLeft = boards.filter(board => (timedOut.indexOf(board) === -1));
    // const removed = normDeployments.filter(a => !boardsLeft.find(d => d.boardReference === a.boardReference));
    // await Promise.all(added.map(a => _createBoardDeployment({ board: a, versions, registry, clusterOptions, options })));
    // await Promise.all(removed.map(a => kubernetes.deleteExposedDeployment(a.boardReference, deploymentType)));
};

const update = async () => {
    const devenvs = await db.getDevenvs();
    const devenvsByType = devenvs.reduce((acc, devenv) => {
        if (!acc[devenv.type]) {
            acc[devenv.type] = [];
        }
        acc[devenv.type].push(devenv);
        return acc;
    }, {});

    Object.keys(devenvsByType).forEach((devenv) => {

    });

    const pending = devenvs.filter(b => b.status === devenvStatuses.PENDING);
};
module.exports = {
    reconcile, updateTensorboards
};
