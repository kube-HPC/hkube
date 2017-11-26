const prom = require('lib/utils/prometheus');
const express = require('express');

const metricsRoute = function () {
    const router = express.Router();
    router.get('/', (req, res, next) => {
        res.send(prom.metrics());
        next();
    });

    return router;
};

const beforeRouteMiddleware = () => {
    return (req, res, next) => {
        res.locals.startEpoch = Date.now();
        next();
    };

}
const afterRouteMiddleware = () => {
    return (req, res, next) => {
        const responseTimeInMs = Date.now() - res.locals.startEpoch;
        prom.httpRequestDurationMicroseconds({
            method: req.method,
            route: req.originalUrl,
            code: res.statusCode,
            duration: responseTimeInMs
        });
        prom.requestCounter({ method: req.method, path: req.originalUrl, code: res.statusCode });
        next()
    }
};
module.exports = {
    metricsRoute,
    beforeRouteMiddleware,
    afterRouteMiddleware
};