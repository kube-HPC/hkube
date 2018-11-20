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
    router.all('/results/:name?', methods(['GET']), logger(), (req, res, next) => {
        const { name } = req.params;
        const { sort, order, limit } = req.query;
        Execution.getCronResult({ name, sort, order, limit }).then((response) => {
            res.json(response);
            res.name = name;
            next();
        }).catch((error) => {
            return next(error);
        });
    });
    router.all('/status/:name?', methods(['GET']), logger(), (req, res, next) => {
        const { name } = req.params;
        const { sort, order, limit } = req.query;
        Execution.getCronStatus({ name, sort, order, limit }).then((response) => {
            res.json(response);
            res.name = name;
            next();
        }).catch((error) => {
            return next(error);
        });
    });
    router.all('/stop', methods(['POST']), logger(), (req, res, next) => {
        const { name } = req.body;
        Execution.getCronStatus({ name, sort, order, limit }).then((response) => {
            res.json(response);
            res.name = name;
            next();
        }).catch((error) => {
            return next(error);
        });
    });
    return router;
};

module.exports = routes;
