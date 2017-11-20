/*
 * Created by nassi on 15/10/15.
 *
 * This module is a simple handler for /catalog route
 * The module exports the routes function.
 *
 */

const Execution = require('lib/service/ExecutionService');
const express = require('express');
const metrics = require('../../../../lib/utils/prometheus');
const routes = function () {
    const router = express.Router();
    router.use((req, res, next) => {
        res.locals.startEpoch = Date.now();
        next();
    });
    router.get('/', (req, res) => {
        res.json({message: 'exec server'});
        next()
    });
    router.post('/raw', (req, res, next) => {
        Execution.runRaw(req.body).then((response) => {
            res.json(response);
        }).catch((error) => {
            return next(error);
        });
        next()
    });
    router.post('/stored', async (req, res, next) => {
        Execution.runStored(req.body).then((response) => {
            res.json({executionID: response});
        }).catch((error) => {
            return next(error);
        });
        next()
    });
    router.get('/status/:executionID', (req, res, next) => {
        const executionID = req.params.executionID;
        Execution.getJobStatus({executionID}).then((response) => {
            res.json(response);
        }).catch((error) => {
            return next(error);
        });
        next()
    });
    router.get('/results/:executionID', (req, res, next) => {
        const executionID = req.params.executionID;
        Execution.getJobResult({executionID}).then((response) => {
            res.json(response);
        }).catch((error) => {
            return next(error);
        });
        next()
    });
    router.post('/stop', (req, res, next) => {
        Execution.stopJob(req.body).then((response) => {
            res.json({message: 'pipeline stopped successfully'});
        }).catch((error) => {
            return next(error);
        });
        next()
    });

    router.use((req, res, next) => {
        const responseTimeInMs = Date.now() - res.locals.startEpoch;
        metrics.httpRequestDurationMicroseconds({
            method: req.method,
            route: req.originalUrl,
            code: res.statusCode
        }).observe(responseTimeInMs);
        metrics.requestCounter.inc({method: req.method, path: req.route.path, code: res.statusCode});
        next()
    });

    return router;
};

module.exports = routes;

