/*
 * Created by nassi on 15/10/15.
 *
 * This module is a simple handler for /catalog route
 * The module exports the routes function.
 *
 */

const prom = require('lib/utils/prometheus');
const express = require('express');

const routes = function () {
    const router = express.Router();
    router.get('/', (req, res, next) => {
        res.send(prom.metrics());
        next();
    });

    return router;
};

const beforeMiddleware = (req, res, next)=>{
        res.locals.startEpoch = Date.now();
        next();
};
const afterMiddleware = (req, res, next)=>{
    const responseTimeInMs = Date.now() - res.locals.startEpoch;
    prom.httpRequestDurationMicroseconds({
        method: req.method,
        route: req.originalUrl,
        code: res.statusCode,
        duration: responseTimeInMs
    });
    prom.requestCounter({method: req.method, path: req.route.path, code: res.statusCode});
    next()
};
module.exports = {
    routes,
    beforeMiddleware,
    afterMiddleware
};

