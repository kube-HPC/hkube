const Execution = require('lib/service/ExecutionService');
const express = require('express');

const routes = function (options) {
    const router = express.Router();
    router.get('/', (req, res, next) => {
        res.json({ message: `${options.version} ${options.file} api` });
        next();
    });
    router.post('/raw', (req, res, next) => {
        Execution.runRaw(req.body).then((response) => {
            res.json({ execution_id: response });
            next();
        }).catch((error) => {
            return next(error);
        });
    });
    router.post('/stored', (req, res, next) => {
        Execution.runStored(req.body).then((response) => {
            res.json({ execution_id: response });
            next();
        }).catch((error) => {
            return next(error);
        });
    });
    router.get('/status', (req, res, next) => {
        const execution_id = req.query.execution_id;
        Execution.getJobStatus({ execution_id }).then((response) => {
            res.json(response);
            next();
        }).catch((error) => {
            return next(error);
        });
    });
    router.get('/results', (req, res, next) => {
        const execution_id = req.query.execution_id;
        Execution.getJobResult({ execution_id }).then((response) => {
            res.json(response);
            next();
        }).catch((error) => {
            return next(error);
        });
    });
    router.post('/stop', (req, res, next) => {
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

