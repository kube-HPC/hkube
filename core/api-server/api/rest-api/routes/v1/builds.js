const RestServer = require('@hkube/rest-server');
const builds = require('../../../../lib/service/builds');
const methods = require('../../middlewares/methods');
const gitListener = require('../../../../lib/service/githooks/git-webhook-listener');
const { WEBHOOKS } = require('../../../../lib/consts/builds');

const routes = (options) => {
    const router = RestServer.router();
    router.get('/', (req, res) => {
        res.json({ message: `${options.version} ${options.file} api` });
    });
    router.all('/status/:buildId?', methods(['GET']), async (req, res) => {
        const { buildId } = req.params;
        const response = await builds.getBuild({ buildId });
        res.json(response);
    });
    router.all('/list/:name?', methods(['GET']), async (req, res) => {
        const { name } = req.params;
        const { sort, order, limit } = req.query;
        const response = await builds.getBuilds({ name, sort, order, limit });
        res.json(response);
    });
    router.all('/stop', methods(['POST']), async (req, res) => {
        const { buildId } = req.body;
        await builds.stopBuild({ buildId });
        res.json({ message: 'OK' });
    });
    router.all('/rerun', methods(['POST']), async (req, res) => {
        const { buildId } = req.body;
        await builds.rerunBuild({ buildId });
        res.json({ message: 'OK' });
    });
    router.all('/webhook/github', methods(['POST']), async (req, res) => {
        const response = await gitListener.listen(JSON.parse(req.body.payload), WEBHOOKS.GITHUB);
        res.json(response);
    });
    router.all('/webhook/gitlab', methods(['POST']), async (req, res) => {
        const response = await gitListener.listen(req.body, WEBHOOKS.GITLAB);
        res.json(response);
    });
    return router;
};

module.exports = routes;
