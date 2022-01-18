const RestServer = require('@hkube/rest-server');
const managedQueue = require('../../../lib/service/managed');

const routes = () => {
    const router = RestServer.router();
    router.get('/', (req, res) => {
        const { pageSize: pageSizeStr, fromJob, toJob, tag, pipelineName } = req.query;
        const pageSize = parseInt(pageSizeStr, 10);
        const response = managedQueue.getFlatJobsList(pageSize, fromJob, toJob, pipelineName, tag);
        res.json(response);
    });
    router.get('/aggregation/tag/', (req, res) => {
        const response = managedQueue.groupBy('tag');
        res.json(response);
    });
    router.get('/aggregation/pipeline/', (req, res) => {
        const response = managedQueue.groupBy('pipelineName');
        res.json(response);
    });
    return router;
};

module.exports = routes;