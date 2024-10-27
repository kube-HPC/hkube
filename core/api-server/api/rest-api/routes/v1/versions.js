const RestServer = require('@hkube/rest-server');
const HttpStatus = require('http-status-codes');
const algoVersionsService = require('../../../../lib/service/algorithm-versions');
const pipelineVersionsService = require('../../../../lib/service/pipeline-versions');

const routes = (options) => {
    const router = RestServer.router();
    router.get('/', (req, res) => {
        res.json({ message: `${options.version} ${options.file} api` });
    });
    // Algorithms
    router.get('/algorithms/:name', async (req, res) => {
        const { name } = req.params;
        const { sort, order, limit } = req.query;
        const response = await algoVersionsService.getVersions({ name, sort, order, limit });
        res.json(response);
    });
    router.get('/algorithms/:name/:version', async (req, res) => {
        const response = await algoVersionsService.getVersion(req.params);
        res.json(response);
    });
    router.post('/algorithms/apply', async (req, res) => {
        const response = await algoVersionsService.applyVersion(req.body);
        res.status(HttpStatus.StatusCodes.CREATED).json(response);
    });
    router.post('/algorithms/tag', async (req, res) => {
        const response = await algoVersionsService.tagVersion(req.body);
        res.status(HttpStatus.StatusCodes.CREATED).json(response);
    });
    router.delete('/algorithms/:name/:version', async (req, res) => {
        const response = await algoVersionsService.deleteVersion(req.params);
        res.json(response);
    });

    // Pipelines
    router.get('/pipelines/:name', async (req, res) => {
        const { name } = req.params;
        const { sort, order, limit } = req.query;
        const response = await pipelineVersionsService.getVersions({ name, sort, order, limit });
        res.json(response);
    });
    router.get('/pipelines/:name/:version', async (req, res) => {
        const response = await pipelineVersionsService.getVersion(req.params);
        res.json(response);
    });

    return router;
};

module.exports = routes;
