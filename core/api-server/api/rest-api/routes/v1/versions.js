const express = require('express');
const HttpStatus = require('http-status-codes');
const versionsService = require('../../../../lib/service/versions');
const logger = require('../../middlewares/logger');

const routes = (options) => {
    const router = express.Router();
    router.get('/', (req, res, next) => {
        res.json({ message: `${options.version} ${options.file} api` });
        next();
    });
    router.get('/algorithms/:name', logger(), async (req, res, next) => {
        const { name } = req.params;
        const { sort, order, limit } = req.query;
        const response = await versionsService.getVersions({ name, sort, order, limit });
        res.json(response);
        next();
    });
    router.get('/algorithms/:name/:version', logger(), async (req, res, next) => {
        const response = await versionsService.getVersion(req.params);
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
    router.delete('/algorithms/:name/:version', logger(), async (req, res, next) => {
        const response = await versionsService.deleteVersion(req.params);
        res.json(response);
        next();
    });

    return router;
};

module.exports = routes;
