const express = require('express');
const builds = require('../../../../lib/service/builds');
const methods = require('../../middlewares/methods');
const logger = require('../../middlewares/logger');

const routes = (options) => {
    const router = express.Router();
    router.get('/', (req, res, next) => {
        res.json({ message: `${options.version} ${options.file} api` });
        next();
    });
    router.all('/status/:buildId?', methods(['GET']), logger(), async (req, res, next) => {
        const { buildId } = req.params;
        const response = await builds.getBuild({ buildId });
        res.json(response);
        next();
    });
    router.all('/list/:name?', methods(['GET']), logger(), async (req, res, next) => {
        const { name } = req.params;
        const { sort, order, limit } = req.query;
        const response = await builds.getBuilds({ name, sort, order, limit });
        res.json(response);
        next();
    });
    router.all('/stop', methods(['POST']), logger(), async (req, res, next) => {
        const { buildId } = req.body;
        await builds.stopBuild({ buildId });
        res.json({ message: 'OK' });
        next();
    });
    router.all('/rerun', methods(['POST']), logger(), async (req, res, next) => {
        const { buildId } = req.body;
        await builds.rerunBuild({ buildId });
        res.json({ message: 'OK' });
        next();
    });
    return router;
};

module.exports = routes;
