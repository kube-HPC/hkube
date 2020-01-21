const express = require('express');
const WebhooksService = require('../../../../lib/service/webhooks');
const methods = require('../../middlewares/methods');
const logger = require('../../middlewares/logger');

const routes = (options) => {
    const router = express.Router();
    router.get('/', (req, res, next) => {
        res.json({ message: `${options.version} ${options.file} api` });
        next();
    });
    router.all('/results/:jobId?', methods(['GET']), logger(), async (req, res, next) => {
        const { jobId } = req.params;
        const response = await WebhooksService.getWebhooksResults({ jobId });
        res.json(response);
        next();
    });
    router.all('/status/:jobId?', methods(['GET']), logger(), async (req, res, next) => {
        const { jobId } = req.params;
        const response = await WebhooksService.getWebhooksStatus({ jobId });
        res.json(response);
        next();
    });
    router.all('/list/:jobId?', methods(['GET']), logger(), async (req, res, next) => {
        const { jobId } = req.params;
        const response = await WebhooksService.getWebhooks({ jobId });
        res.json(response);
        next();
    });
    return router;
};

module.exports = routes;
