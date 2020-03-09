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
    router.all('/list/all', methods(['GET']), logger(), async (req, res, next) => {
        const { sort, order, limit } = req.query;
        const response = await Experiment.experimentsList({ sort, order, limit });
        res.json(response);
        next();
    });

    router.get('/:name?', logger(), async (req, res, next) => {
        const { name } = req.params;
        const response = await Experiment.getExperiment({ name });
        res.json(response);
        res.name = name;
        next();
    });

    router.post('/', logger(), async (req, res, next) => {
        const { name, description } = req.body;
        await Experiment.insertExperiment({ name, description });
        res.json({ message: 'OK', name });
        next();
    });
    router.delete('/:name?', logger(), async (req, res, next) => {
        const { name } = req.params;
        const response = await Experiment.deleteExperiment({ name });
        res.json(response);
        next();
    });

    return router;
};

module.exports = routes;
