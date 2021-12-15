const RestServer = require('@hkube/rest-server');
const preferredService = require('../../../lib/service/preferred-jobs');

const routes = () => {
    const router = RestServer.router();

    router.get('/', async (req, res) => {
        const response = await preferredService.getPreferredJobsList();
        res.json(response);
    });
    router.delete('/', async (req, res) => {
        const { jobs } = req.body;
        const deleted = await preferredService.deletePreferredJobs(jobs);
        res.json({ message: 'Jobs deleted', jobs: deleted });
    });
    router.post('/', async (req, res) => {
        const { jobs, query, position } = req.body;
        const added = await preferredService.addPreferredJobs({
            query,
            position,
            jobs
        });
        const message = 'Jobs added to preferred';
        res.json({ message, jobs: added });
    });
    return router;
};

module.exports = routes;
