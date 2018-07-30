const express = require('express');
const Execution = require('../../../lib/service/execution');
const methods = require('../middlewares/methods');
const logger = require('../middlewares/logger');

const routes = () => {
    const router = express.Router();
    router.get('/', (req, res, next) => {
        res.json({ message: 'internal api' });
        next();
    });
    router.all('/exec/stored', methods(['POST']), logger(), (req, res, next) => {
        Execution.runStoredInternal(req.body).then((jobId) => {
            res.json({ jobId });
            res.jobId = jobId;
            next();
        }).catch((error) => {
            return next(error);
        });
    });
    router.all('/exec/raw', methods(['POST']), logger(), (req, res, next) => {
        Execution.runRaw(req.body).then((jobId) => {
            res.json({ jobId });
            res.jobId = jobId;
            next();
        }).catch((error) => {
            return next(error);
        });
    });
    router.all('/exec/stop', methods(['POST']), logger(), (req, res, next) => {
        const { jobId, reason } = req.body;
        Execution.stopJob({ jobId, reason }).then(() => {
            res.json({ message: 'OK' });
            res.jobId = jobId;
            next();
        }).catch((error) => {
            return next(error);
        });
    });
    router.all('/exec/clean/:jobId?', methods(['POST']), logger(), (req, res, next) => {
        Execution.cleanJob(req.body).then((jobId) => {
            res.json({ message: 'OK' });
            res.jobId = jobId;
            next();
        }).catch((error) => {
            return next(error);
        });
    });

    return router;
};

module.exports = routes;

