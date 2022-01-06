const RestServer = require('@hkube/rest-server');
const preferredService = require('../../../lib/service/preferred-jobs');

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
        const response = preferredService.getFlatJobsList(pageSize, fromJob, toJob, filter);
        res.json(response);
    });
    router.get('/aggregation/pipeline/', (req, res) => {
        const response = preferredService.getPreferredAggregatedByPipeline();
        res.json(response);
    });
    router.get('/aggregation/tag/', (req, res) => {
        const response = preferredService.getPreferredAggregatedByTags();
        res.json(response);
    });
    router.post('/deletes/', async (req, res) => {
        const { jobs } = req.body;
        const deleted = await preferredService.deletePreferredJobs(jobs);
        res.json(deleted);
    });
    router.post('/', async (req, res) => {
        const { jobs, query, position } = req.body;
        const added = await preferredService.addPreferredJobs({
            query,
            position,
            jobs
        });
        res.json(added);
    });
    return router;
};

module.exports = routes;
