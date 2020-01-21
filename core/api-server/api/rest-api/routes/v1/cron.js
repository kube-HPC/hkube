const express = require('express');
const Cron = require('../../../../lib/service/cron');
const methods = require('../../middlewares/methods');
const logger = require('../../middlewares/logger');

const routes = (options) => {
    const router = express.Router();
    router.get('/', (req, res, next) => {
        res.json({ message: `${options.version} ${options.file} api` });
        next();
    });
    router.all('/results', methods(['GET']), logger(), async (req, res, next) => {
        const { experimentName, name, sort, order, limit } = req.query;
        const response = await Cron.getCronResult({ experimentName, name, sort, order, limit });
        res.json(response);
        res.name = name;
        next();
    });
    router.all('/status', methods(['GET']), logger(), async (req, res, next) => {
        const { experimentName, name, sort, order, limit } = req.query;
        const response = await Cron.getCronStatus({ experimentName, name, sort, order, limit });
        res.json(response);
        res.name = name;
        next();
    });
    router.all('/list/:name?', methods(['GET']), logger(), async (req, res, next) => {
        const { sort, order, limit } = req.query;
        const response = await Cron.getCronList({ sort, order, limit });
        res.json(response);
        next();
    });
    router.all('/start', methods(['POST']), logger(), async (req, res, next) => {
        const { name, pattern } = req.body;
        await Cron.startCronJob({ name, pattern });
        res.json({ message: 'OK' });
        res.name = name;
        next();
    });
    router.all('/stop', methods(['POST']), logger(), async (req, res, next) => {
        const { name, pattern } = req.body;
        await Cron.stopCronJob({ name, pattern });
        res.json({ message: 'OK' });
        res.name = name;
        next();
    });
    return router;
};

module.exports = routes;
