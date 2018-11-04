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
    router.all('/results/:jobId?', methods(['GET']), logger(), (req, res, next) => {
        const { jobId } = req.params;
        WebhooksService.getWebhooksResults({ jobId }).then((response) => {
            res.json(response);
            next();
        }).catch((error) => {
            return next(error);
        });
    });
    router.all('/status/:jobId?', methods(['GET']), logger(), (req, res, next) => {
        const { jobId } = req.params;
        WebhooksService.getWebhooksStatus({ jobId }).then((response) => {
            res.json(response);
            next();
        }).catch((error) => {
            return next(error);
        });
    });
    router.all('/:jobId?', methods(['GET']), logger(), (req, res, next) => {
        const { jobId } = req.params;
        WebhooksService.getWebhooks({ jobId }).then((response) => {
            res.json(response);
            next();
        }).catch((error) => {
            return next(error);
        });
    });
    return router;
};

module.exports = routes;
