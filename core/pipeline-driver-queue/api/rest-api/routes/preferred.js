const RestServer = require('@hkube/rest-server');
const preferredService = require('../../../lib/service/preferred-jobs');

const routes = () => {
    const router = RestServer.router();

    router.get('/', (req, res) => {
        const response = preferredService.getPreferredJobsList();
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
