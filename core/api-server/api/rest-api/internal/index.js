const execRouter = require('./exec');
const algoRouter = require('./algorithms');
const leaderRouter = require('./leader');

const INTERNAL_PREFIX = '/internal/v1';

const getRouter = () => {
    return [
        { route: INTERNAL_PREFIX, router: execRouter() },
        { route: INTERNAL_PREFIX, router: algoRouter() },
        { route: INTERNAL_PREFIX, router: leaderRouter() }
    ];
};

module.exports = getRouter;
