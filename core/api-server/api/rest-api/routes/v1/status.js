const RestServer = require('@hkube/rest-server');

const routes = (options) => {
    const router = RestServer.router();
    router.get('/', (req, res) => {
        res.json({ message: `${options.version} ${options.file} api` });
    });
    router.get('/version', async (req, res) => {
        const version = {
            systemVersion: options.systemVersion,
            clusterName: options.clusterName,
            storage: options.defaultStorage,
        };
        res.json(version);
    });
    return router;
};

module.exports = routes;
