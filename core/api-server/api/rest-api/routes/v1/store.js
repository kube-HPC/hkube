/*
 * Created by nassi on 15/10/15.
 *
 * This module is a simple handler for /catalog route
 * The module exports the routes function.
 *
 */

const express = require('express');
const Store = require('lib/service/StoreService');
const metrics = require('../../../../lib/utils/prometheus');

var routes = function () {
    const router = express.Router();
    router.use( (req, res, next)=>{
        res.locals.startEpoch = Date.now();
        next();
    });
    router.get('/', function (req, res) {
        res.json({ message: 'store api' });
    });
    router.get('/pipelines', (req, res, next) => {
        Store.getPipelines().then((response) => {
            res.json(response);
        }).catch((response) => {
            return next(error);
        });
        next()
    });
    router.get('/pipelines/:pipelineName', (req, res, next) => {
        const pipelineName = req.params.pipelineName;
        Store.getPipeline(pipelineName).then((response) => {
            res.json(response);
        }).catch((response) => {
            return next(error);
        });
        next()
    });
    router.post('/pipelines', (req, res, next) => {
        Store.updatePipeline(req.body).then((response) => {
            res.json(response);
        }).catch((response) => {
            return next(error);
        });
        next()
    });
    router.put('/pipelines', (req, res, next) => {
        Store.updatePipeline(req.body).then((response) => {
            res.json(response);
        }).catch((response) => {
            return next(error);
        });
        next()
    });
    router.delete('/pipelines/:pipelineName', (req, res, next) => {
        const pipelineName = req.params.pipelineName;
        Store.deletePipeline(pipelineName).then((response) => {
            res.json(response);
        }).catch((response) => {
            return next(error);
        });
        next()
    });
    router.use( (req, res, next)=>{
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

