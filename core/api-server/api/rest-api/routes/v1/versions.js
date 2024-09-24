const RestServer = require('@hkube/rest-server');
const HttpStatus = require('http-status-codes');
const versionsService = require('../../../../lib/service/algorithm-versions');

const routes = (options) => {
    const router = RestServer.router();
    router.get('/', (req, res) => {
        res.json({ message: `${options.version} ${options.file} api` });
    });
    router.get('/algorithms/:name', async (req, res) => {
        const { name } = req.params;
        const { sort, order, limit } = req.query;
        const response = await versionsService.getVersions({ name, sort, order, limit });
        res.json(response);
    });
    router.get('/algorithms/:name/:version', async (req, res) => {
        const response = await versionsService.getVersion(req.params);
        res.json(response);
    });
    router.post('/algorithms/apply', async (req, res) => {
        const response = await versionsService.applyVersion(req.body);
        res.status(HttpStatus.CREATED).json(response);
    });
    router.post('/algorithms/tag', async (req, res) => {
        const response = await versionsService.tagVersion(req.body);
        res.status(HttpStatus.CREATED).json(response);
    });
    router.delete('/algorithms/:name/:version', async (req, res) => {
        const response = await versionsService.deleteVersion(req.params);
        res.json(response);
    });
    return router;
};

module.exports = routes;
