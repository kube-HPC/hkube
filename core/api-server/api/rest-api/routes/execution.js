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
        res.json({ message: 'api server' });
    });
    router.post('/v1/run/raw', (req, res, next) => {
        const data = req.body;
        if (!data.name) {
            var error = new Error('invalid pipeline name');
            error.status = 400;
            return next(error);
        }
        Execution.runRaw(data).then((response) => {
            res.json(response);
        }).catch((error) => {
            res.json(error);
        });
    });
    router.post('/v1/run/stored', (req, res, next) => {
        const data = req.body;
        if (!data.name) {
            var error = new Error('invalid pipeline name');
            error.status = 400;
            return next(error);
        }
        Execution.runStored(data).then((response) => {
            res.json({ executionID: response });
        }).catch((error) => {
            return next(error);
        });
    });
    router.get('/v1/status/:executionID', (req, res, next) => {
        const executionID = req.params.executionID;
        Execution.getJobStatus(executionID).then((response) => {
            res.json(response);
        }).catch((error) => {
            return next(error);
        });
    });
    router.get('/v1/results/:executionID', (req, res, next) => {
        const executionID = req.params.executionID;
        Execution.getJobResult(executionID).then((response) => {
            res.json(response);
        }).catch((error) => {
            res.json(error);
        });
    });
    router.post('/v1/stop', (req, res, next) => {
        const executionID = req.body.executionID;
        if (!executionID) {
            var error = new Error('invalid executionID');
            error.status = 400;
            return next(error);
        }
        Execution.stop(executionID, req.body.reason).then((response) => {
            res.json(response);
        }).catch((error) => {
            return next(error);
        });
    });

    return router;
};

module.exports = routes;

