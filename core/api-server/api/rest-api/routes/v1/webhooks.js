const RestServer = require('@hkube/rest-server');
const WebhooksService = require('../../../../lib/service/webhooks');
const methods = require('../../middlewares/methods');

const routes = (options) => {
    const router = RestServer.router();
    router.get('/', (req, res) => {
        res.json({ message: `${options.version} ${options.file} api` });
    });
    router.all('/results/:jobId?', methods(['GET']), async (req, res) => {
        const { jobId } = req.params;
        const response = await WebhooksService.getWebhooksResults({ jobId });
        res.json(response);
    });
    router.all('/status/:jobId?', methods(['GET']), async (req, res) => {
        const { jobId } = req.params;
        const response = await WebhooksService.getWebhooksStatus({ jobId });
        res.json(response);
    });
    router.all('/list/:jobId?', methods(['GET']), async (req, res) => {
        const { jobId } = req.params;
        const response = await WebhooksService.getWebhooks({ jobId });
        res.json(response);
    });
    return router;
};

module.exports = routes;
