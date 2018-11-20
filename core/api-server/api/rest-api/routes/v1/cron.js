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
    router.all('/results/:name?', methods(['GET']), logger(), (req, res, next) => {
        const { name } = req.params;
        const { sort, order, limit } = req.query;
        Cron.getCronResult({ name, sort, order, limit }).then((response) => {
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
        Cron.getCronStatus({ name, sort, order, limit }).then((response) => {
            res.json(response);
            res.name = name;
            next();
        }).catch((error) => {
            return next(error);
        });
    });
    router.all('/list/:name?', methods(['GET']), logger(), (req, res, next) => {
        const { sort, order, limit } = req.query;
        Cron.getCronList({ sort, order, limit }).then((response) => {
            res.json(response);
            next();
        }).catch((error) => {
            return next(error);
        });
    });
    router.all('/start', methods(['POST']), logger(), (req, res, next) => {
        const { name } = req.body;
        Cron.startCronJob({ name }).then(() => {
            res.json({ message: 'OK' });
            res.name = name;
            next();
        }).catch((error) => {
            return next(error);
        });
    });
    router.all('/stop', methods(['POST']), logger(), (req, res, next) => {
        const { name } = req.body;
        Cron.stopCronJob({ name }).then(() => {
            res.json({ message: 'OK' });
            res.name = name;
            next();
        }).catch((error) => {
            return next(error);
        });
    });
    return router;
};

module.exports = routes;
