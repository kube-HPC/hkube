const express = require('express');
const HttpStatus = require('http-status-codes');
const versionsService = require('../../../../lib/service/versions');
const logger = require('../../middlewares/logger');

// TODO: UPDATE DASHBOARD....
const routes = (options) => {
    const router = express.Router();
    router.get('/', (req, res, next) => {
        res.json({ message: `${options.version} ${options.file} api` });
        next();
    });
    router.get('/algorithms/:name', logger(), async (req, res, next) => {
        const { name } = req.params;
        const { id, sort, order, limit } = req.query;
        const response = await versionsService.getVersions({ name, id, sort, order, limit });
        res.json(response);
        next();
    });
    router.post('/algorithms/apply', logger(), async (req, res, next) => {
        const response = await versionsService.applyVersion(req.body);
        res.status(HttpStatus.CREATED).json(response);
        next();
    });
    router.post('/algorithms/tag', logger(), async (req, res, next) => {
        const response = await versionsService.tagVersion(req.body);
        res.status(HttpStatus.CREATED).json(response);
        next();
    });
    router.delete('/algorithms/:name', logger(), async (req, res, next) => {
        const { name } = req.params;
        const { id } = req.query;
        const response = await versionsService.deleteVersion({ name, id });
        res.json(response);
        next();
    });

    return router;
};

module.exports = routes;
