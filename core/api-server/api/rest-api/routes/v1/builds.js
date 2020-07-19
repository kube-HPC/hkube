const express = require('express');
const builds = require('../../../../lib/service/builds');
const methods = require('../../middlewares/methods');
const logger = require('../../middlewares/logger');
const gitListener = require('../../../../lib/service/githooks/git-webhook-listener');
const { WEBHOOKS } = require('../../../../lib/consts/builds');

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
    router.all('/webhook/github', methods(['POST']), logger(), async (req, res, next) => {
        const response = await gitListener.listen(JSON.parse(req.body.payload), WEBHOOKS.GITHUB);
        res.json(response);
        next();
    });
    router.all('/webhook/gitlab', methods(['POST']), logger(), async (req, res, next) => {
        const response = await gitListener.listen(req.body, WEBHOOKS.GITLAB);
        res.json(response);
        next();
    });
    return router;
};

module.exports = routes;
