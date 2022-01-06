const RestServer = require('@hkube/rest-server');
const managedQueue = require('../../../lib/service/managed');

const routes = () => {
    const router = RestServer.router();
    router.get('/', (req, res) => {
        const { pageSize: pageSizeStr, fromJob, toJob, tag, pipelineName } = req.query;
        const pageSize = parseInt(pageSizeStr, 10);
        let filter;
        if (tag || pipelineName) {
            filter = {};
            filter.pipelineName = pipelineName;
            filter.tag = tag;
        }
        const response = managedQueue.getFlatJobsList(pageSize, fromJob, toJob, filter);
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
