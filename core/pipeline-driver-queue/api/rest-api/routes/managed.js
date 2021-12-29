const RestServer = require('@hkube/rest-server');
const managedQueue = require('../../../lib/service/managed');

const routes = () => {
    const router = RestServer.router();
    router.post('/', (req, res) => {
        const { pageSize, fromJob, toJob, filter } = req.body;
        const response = managedQueue.getFlatJobsList(pageSize, fromJob, toJob, filter);
        res.json(response);
    });
    router.get('/aggregation/tag/', (req, res) => {
        const response = managedQueue.groupBy('tag');
        res.json(response);
    });
    router.get('/aggregation/pipeline/', (req, res) => {
        const response = managedQueue.groupBy('pipeline');
        res.json(response);
    });
    return router;
};

module.exports = routes;
