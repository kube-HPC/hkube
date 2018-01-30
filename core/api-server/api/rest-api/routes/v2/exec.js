const express = require('express');
const Execution = require('../../../../lib/service/ExecutionService');
const methods = require('../../middlewares/methods');

const routes = (options) => {
    const router = express.Router();
    router.get('/', (req, res, next) => {
        res.json({ message: `${options.version} ${options.file} api` });
        next();
    });
    router.all('/raw', methods(['POST']), (req, res, next) => {
        Execution.runRaw(req.body).then((jobId) => {
            res.json({ jobId });
            res.jobId = jobId;
            next();
        }).catch((error) => {
            return next(error);
        });
    });
    router.all('/stored', methods(['POST']), (req, res, next) => {
        Execution.runStored(req.body).then((jobId) => {
            res.json({ jobId });
            res.jobId = jobId;
            next();
        }).catch((error) => {
            return next(error);
        });
    });
    router.all('/status/:jobId?', methods(['GET']), (req, res, next) => {
        const { jobId } = req.params;
        Execution.getJobStatus({ jobId }).then((response) => {
            res.json(response);
            res.jobId = jobId;
            next();
        }).catch((error) => {
            return next(error);
        });
    });
    router.all('/results/:jobId?', methods(['GET']), (req, res, next) => {
        const { jobId } = req.params;
        Execution.getJobResult({ jobId }).then((response) => {
            res.json(response);
            res.jobId = jobId;
            next();
        }).catch((error) => {
            return next(error);
        });
    });
    router.all('/stop', methods(['POST']), (req, res, next) => {
        const { jobId, reason } = req.body;
        Execution.stopJob({ jobId, reason }).then(() => {
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

