const express = require('express');
const Execution = require('../../../../lib/service/execution');
const WebhooksService = require('../../../../lib/service/webhooks');
const methods = require('../../middlewares/methods');

const routes = (options) => {
    const router = express.Router();
    router.get('/', (req, res, next) => {
        res.json({ message: `${options.version} ${options.file} api` });
        next();
    });

    router.all('/exec/:jobId?', methods(['GET']), (req, res, next) => {
        const { jobId } = req.params;
        Execution.getPipeline({ jobId }).then((response) => {
            res.json(response);
            next();
        }).catch((error) => {
            return next(error);
        });
    });

    router.all('/webhooks/results/:jobId?', methods(['GET']), (req, res, next) => {
        const { jobId } = req.params;
        WebhooksService.getWebhooksResults({ jobId }).then((response) => {
            res.json(response);
            next();
        }).catch((error) => {
            return next(error);
        });
    });

    router.all('/webhooks/status/:jobId?', methods(['GET']), (req, res, next) => {
        const { jobId } = req.params;
        WebhooksService.getWebhooksStatus({ jobId }).then((response) => {
            res.json(response);
            next();
        }).catch((error) => {
            return next(error);
        });
    });

    return router;
};

module.exports = routes;

