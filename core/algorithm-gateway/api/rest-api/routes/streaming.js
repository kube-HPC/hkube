const RestServer = require('@hkube/rest-server');
const algorithm = require('../../../lib/index');

const routes = () => {
    const router = RestServer.router();
    router.post('/message', (req, res) => {
        const { flow } = req.query;
        const message = req.body;
        if (!flow || typeof flow !== 'string' || flow.length === 0) {
            return res.status(400).json({ error: 'flow query parameter is required' });
        }
        if (message === undefined || message === null) {
            return res.status(400).json({ error: 'message body is required' });
        }
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
