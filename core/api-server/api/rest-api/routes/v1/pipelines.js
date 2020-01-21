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

    router.all('/results', methods(['GET']), logger(), async (req, res, next) => {
        const { name, experimentName, sort, order, limit } = req.query;
        const response = await Execution.getPipelinesResult({ name, experimentName, sort, order, limit });
        res.json(response);
        res.name = name;
        next();
    });

    router.all('/status', methods(['GET']), logger(), async (req, res, next) => {
        const { name, experimentName, sort, order, limit } = req.query;
        const response = await Execution.getPipelinesStatus({ name, experimentName, sort, order, limit });
        res.json(response);
        res.name = name;
        next();
    });
    return router;
};

module.exports = routes;
