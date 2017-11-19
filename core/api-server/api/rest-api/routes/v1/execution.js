/*
 * Created by nassi on 15/10/15.
 *
 * This module is a simple handler for /catalog route
 * The module exports the routes function.
 *
 */

const Execution = require('lib/service/ExecutionService');
const express = require('express');

const routes = function () {
    const router = express.Router();

    router.get('/', (req, res) => {
        res.json({ message: 'exec server' });
    });
    router.post('/raw', (req, res, next) => {
        Execution.runRaw(req.body).then((response) => {
            res.json(response);
        }).catch((error) => {
            return next(error);
        });
    });
    router.post('/stored', async (req, res, next) => {
        Execution.runStored(req.body).then((response) => {
            res.json({ executionID: response });
        }).catch((error) => {
            return next(error);
        });
    });
    router.get('/status/:executionID', (req, res, next) => {
        const executionID = req.params.executionID;
        Execution.getJobStatus({ executionID }).then((response) => {
            res.json(response);
        }).catch((error) => {
            return next(error);
        });
    });
    router.get('/results/:executionID', (req, res, next) => {
        const executionID = req.params.executionID;
        Execution.getJobResult({ executionID }).then((response) => {
            res.json(response);
        }).catch((error) => {
            return next(error);
        });
    });
    router.post('/stop', (req, res, next) => {
        Execution.stopJob(req.body).then((response) => {
            res.json({ message: 'pipeline stopped successfully' });
        }).catch((error) => {
            return next(error);
        });
    });

    return router;
};

module.exports = routes;

