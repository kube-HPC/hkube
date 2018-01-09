const express = require('express');
const Execution = require('lib/service/ExecutionService');
const methods = require('api/rest-api/middlewares/methods');

const routes = function (options) {
    const router = express.Router();
    router.get('/', (req, res, next) => {
        res.json({ message: `${options.version} ${options.file} api` });
        next();
    });
    router.all('/raw', methods(['POST']), (req, res, next) => {
        Execution.runRaw(req.body).then((response) => {
            res.json({ jobId: response });
            next();
        }).catch((error) => {
            return next(error);
        });
    });
    router.all('/stored', methods(['POST']), (req, res, next) => {
        Execution.runStored(req.body).then((response) => {
            res.json({ jobId: response });
            next();
        }).catch((error) => {
            return next(error);
        });
    });
    router.all('/status/:jobId?', methods(['GET']), (req, res, next) => {
        const jobId = req.params.jobId
        Execution.getJobStatus({ jobId }).then((response) => {
            res.json(response);
            next();
        }).catch((error) => {
            return next(error);
        });
    })
    router.all('/results/:jobId?', methods(['GET']), (req, res, next) => {
        const jobId = req.params.jobId;
        Execution.getJobResult({ jobId }).then((response) => {
            res.json(response);
            next();
        }).catch((error) => {
            return next(error);
        });
    })
    router.all('/stop', methods(['POST']), (req, res, next) => {
        Execution.stopJob(req.body).then((response) => {
            res.json({ message: 'OK' });
            next();
        }).catch((error) => {
            return next(error);
        });
    });

    return router;
};

module.exports = routes;

