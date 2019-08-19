const express = require('express');
const Execution = require('../../../../lib/service/execution');
const methods = require('../../middlewares/methods');
const logger = require('../../middlewares/logger');

const routes = (options) => {
    const router = express.Router();
    router.get('/', (req, res, next) => {
        res.json({ message: `${options.version} ${options.file} api` });
        next();
    });
    router.all('/results/raw/:name?', methods(['GET']), logger(), async (req, res, next) => {
        const { name } = req.params;
        const { sort, order, limit } = req.query;
        const response = await Execution.getPipelinesResultRaw({ name, sort, order, limit });
        res.json(response);
        res.name = name;
        next();
    });
    router.all('/results/stored/:name?', methods(['GET']), logger(), async (req, res, next) => {
        const { name } = req.params;
        const { sort, order, limit } = req.query;
        const response = await Execution.getPipelinesResultStored({ name, sort, order, limit });
        res.json(response);
        res.name = name;
        next();
    });
    router.all('/status/raw/:name?', methods(['GET']), logger(), async (req, res, next) => {
        const { name } = req.params;
        const { sort, order, limit } = req.query;
        const response = await Execution.getPipelinesStatusRaw({ name, sort, order, limit });
        res.json(response);
        res.name = name;
        next();
    });
    router.all('/status/stored/:name?', methods(['GET']), logger(), async (req, res, next) => {
        const { name } = req.params;
        const { sort, order, limit } = req.query;
        const response = await Execution.getPipelinesStatusStored({ name, sort, order, limit });
        res.json(response);
        res.name = name;
        next();
    });
    return router;
};

module.exports = routes;
