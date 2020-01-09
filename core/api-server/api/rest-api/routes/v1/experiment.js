const express = require('express');
const Experiment = require('../../../../lib/service/experiment');
const methods = require('../../middlewares/methods');
const logger = require('../../middlewares/logger');

const routes = (options) => {
    const router = express.Router();
    router.get('/', (req, res, next) => {
        res.json({ message: `${options.version} ${options.file} api` });
        next();
    });
    router.all('/list/:name?', methods(['GET']), logger(), async (req, res, next) => {
        const { name } = req.params;
        const { sort, order, limit } = req.query;
        const response = await Experiment.experimentsList({ sort, order, limit });
        res.json(response);
        res.name = name;
        next();
    });
    router.all('/:name?', methods(['GET']), logger(), async (req, res, next) => {
        const { name } = req.params;
        const { sort, order, limit } = req.query;
        const response = await Experiment.getExperiment({ name, sort, order, limit });
        res.json(response);
        res.name = name;
        next();
    });
    router.all('/:name?', methods(['POST']), logger(), async (req, res, next) => {
        const { name } = req.params;
        const { sort, order, limit } = req.query;
        const response = await Experiment.setExperiment({ name, sort, order, limit });
        res.json(response);
        res.name = name;
        next();
    });
    router.all('/:name?', methods(['DELETE']), logger(), async (req, res, next) => {
        const { name } = req.params;
        const { sort, order, limit } = req.query;
        const response = await Experiment.deleteExperiment({ name, sort, order, limit });
        res.json(response);
        res.name = name;
        next();
    });

    return router;
};

module.exports = routes;
