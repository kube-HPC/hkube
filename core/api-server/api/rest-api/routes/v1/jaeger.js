const RestServer = require('@hkube/rest-server');
const { pipeTrace } = require('../../../../lib/service/jaeger-api');

const routes = (options) => {
    const router = RestServer.router();
    router.get('/', async (req, res) => {
        await pipeTrace(req.query.jobId, res);
    });

    return router;
};

module.exports = routes;
