const RestServer = require('@hkube/rest-server');
const cleanerManager = require('../../../lib/cleaner-manager');

const routes = () => {
    const router = RestServer.router();
    router.post('/', async (req, res) => {
        const { maxAge } = req.body;
        const result = await cleanerManager.cleanAll({ maxAge });
        res.json(result);
    });
    router.post('/:type?', async (req, res) => {
        const { type } = req.params;
        const { maxAge } = req.body;
        const result = await cleanerManager.clean({ type, maxAge });
        res.json(result);
    });
    return router;
};

module.exports = routes;
