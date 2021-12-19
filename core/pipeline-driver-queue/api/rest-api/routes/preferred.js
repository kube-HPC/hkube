const RestServer = require('@hkube/rest-server');
const preferredService = require('../../../lib/service/preferred-jobs');

const routes = () => {
    const router = RestServer.router();

    router.get('/', async (req, res) => {
        const response = preferredService.getPreferredJobsList();
        res.json(response);
    });
    router.post('/', async (req, res) => {
        const { addedJobs, removedJobs } = req.body;
        let added = [];
        let removed = [];
        if (removedJobs && Array.isArray(removedJobs)) {
            removed = preferredService.deletePreferredJobs(removedJobs);
        }
        if (addedJobs) {
            const { jobs, query, position } = addedJobs;
            added = preferredService.addPreferredJobs({
                query,
                position,
                jobs
            });
        }
        res.json({ addedJobs: added, removedJobs: removed });
    });
    return router;
};

module.exports = routes;
