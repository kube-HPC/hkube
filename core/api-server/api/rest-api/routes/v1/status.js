const RestServer = require('@hkube/rest-server');
const logger = require('../../middlewares/logger');

const routes = (options) => {
    const router = RestServer.router();
    router.get('/', (req, res, next) => {
        res.json({ message: `${options.version} ${options.file} api` });
        next();
    });
    router.get('/version', logger(), async (req, res, next) => {
        const version = {
            systemVersion: options.systemVersion,
            clusterName: options.clusterName,
            storage: options.defaultStorage,
            time: Date.now()
        };
        res.json(version);
        next();
    });
    return router;
};

module.exports = routes;
