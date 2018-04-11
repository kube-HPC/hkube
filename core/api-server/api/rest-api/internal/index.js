
const router = require('./exec');

const getRouter = () => {
    return { route: '/internal/v1', router: router() };
};

module.exports = getRouter;
