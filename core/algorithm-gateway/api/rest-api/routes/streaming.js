const RestServer = require('@hkube/rest-server');
const algorithm = require('../../../algorithm_unique_folder');

const routes = () => {
    const router = RestServer.router();
    router.post('/message', (req, res) => {
        const { flow } = req.query;
        const message = req.body;
        algorithm.streamMessage(message, flow);
        res.json({ message: 'OK' });
    });
    router.get('/info', (req, res) => {
        const jobData = algorithm.jobData();
        res.json(jobData);
    });
    return router;
};

module.exports = routes;
