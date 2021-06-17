const RestServer = require('@hkube/rest-server');
const Gateway = require('../../../../lib/service/gateway');

const routes = () => {
    const router = RestServer.router();
    router.get('/', async (req, res) => {
        const { sort, order, limit } = req.query;
        const response = await Gateway.getGateways({ sort, order, limit });
        res.json(response);
    });
    router.get('/:name?', async (req, res) => {
        const { name } = req.params;
        const response = await Gateway.getGateway({ name });
        res.json(response);
    });
    return router;
};

module.exports = routes;
