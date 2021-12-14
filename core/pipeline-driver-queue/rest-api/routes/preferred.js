const RestServer = require('@hkube/rest-server');
const preferredService = require('../../../lib/service/preferred-jobs');

const routes = () => {
    const router = RestServer.router();

    router.get('/', async (req, res) => {
        const response = await preferredService.getPreferredJobsList();
        res.json(response);
    });
    router.delete('/:jobId?', async (req, res) => {
        const { jobs } = req.body;
        // const { jobId } = req.params;
        preferredService.deletePreferredJob(jobs);
        res.json({ message: 'Board deleted' });
    });
    router.post('/', async (req, res) => {
        const { jobs, beforeMe } = req.body;
        await preferredService.addPreferredJobs({ jobs, beforeMe });
        const message = 'Jobs added to preferred';
        res.json({ message });
    });
    return router;
};

module.exports = routes;
