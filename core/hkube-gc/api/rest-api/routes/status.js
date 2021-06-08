const RestServer = require('@hkube/rest-server');
const cleanerManager = require('../../../lib/cleaner-manager');

const routes = () => {
    const router = RestServer.router();
    router.get('/', (req, res) => {
        const result = cleanerManager.getStatuses();
        res.json(result);
    });
    router.get('/:type?', (req, res) => {
        const { type } = req.params;
        const result = cleanerManager.getStatus(type);
        res.json(result);
    });
    return router;
};

module.exports = routes;
