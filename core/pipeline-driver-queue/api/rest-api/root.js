const RestServer = require('@hkube/rest-server');
const managedQueue = require('../../lib/service/managed');
const preferredQueue = require('../../lib/service/preferred-jobs');

const routes = () => {
    const router = RestServer.router();
    router.get('/', (req, res) => {
        const { pageSize: pageSizeStr, firstJobId, lastJobId, tag, pipelineName, lastJobs } = req.query;
        const pageSize = parseInt(pageSizeStr, 10);
        const response = managedQueue.getFlatJobsList(pageSize, firstJobId, lastJobId, pipelineName, tag, lastJobs);
        res.json(response);
    });
    router.get('/count/', (req, res) => {
        const managed = managedQueue.getCount();
        const preferred = preferredQueue.getCount();
        res.json({ managed, preferred });
    });
    return router;
};

module.exports = routes;
