const RestServer = require('@hkube/rest-server');
const cleanerManager = require('../../../lib/core/cleaner-manager');

const routes = () => {
    const router = RestServer.router();
    router.post('/', async (req, res) => {
        const { maxAge } = req.body;
        const result = await cleanerManager.dryRunAll({ maxAge });
        res.json(result);
    });
    router.post('/:type?', async (req, res) => {
        const { type } = req.params;
        const { maxAge } = req.body;
        const result = await cleanerManager.dryRun({ type, maxAge });
        res.json(result);
    });
    return router;
};

module.exports = routes;
