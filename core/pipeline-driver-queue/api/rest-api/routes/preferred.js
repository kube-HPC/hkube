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
        preferredService.deletePreferredJob(jobs);
        res.json({ message: 'Board deleted' });
    });
    router.post('/', async (req, res) => {
        const { jobs, query, position } = req.body;
        await preferredService.addPreferredJobs({
            query,
            position,
            jobs
        });
        const message = 'Jobs added to preferred';
        res.json({ message });
    });
    return router;
};

module.exports = routes;
