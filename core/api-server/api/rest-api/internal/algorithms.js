const RestServer = require('@hkube/rest-server');
const Algorithms = require('../../../lib/service/algorithms');
const methods = require('../middlewares/methods');
const logger = require('../middlewares/logger');

const routes = () => {
    const router = RestServer.router();
    router.get('/', (req, res) => {
        res.json({ message: 'internal api' });
    });
    router.all('/algorithms/queue', methods(['GET']), async (req, res) => {
        const response = await Algorithms.getAlgorithmsQueueList();
        res.json(response);
    });
    return router;
};

module.exports = routes;
