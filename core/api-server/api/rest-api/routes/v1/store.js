/*
 * Created by nassi on 15/10/15.
 *
 * This module is a simple handler for /catalog route
 * The module exports the routes function.
 *
 */

const express = require('express');
const Store = require('lib/service/StoreService');

var routes = function () {
    const router = express.Router();
    router.get('/', function (req, res) {
        res.json({ message: 'store api' });
    });
    router.get('/pipelines', (req, res, next) => {
        const sort = req.query.sort;
        Store.getPipelines().then((response) => {
            res.json(response);
            next();
        }).catch((error) => {
            return next(error);
        });
    });
    router.get('/pipelines/:name', (req, res, next) => {
        const name = req.params.name;
        Store.getPipeline({ name }).then((response) => {
            res.json(response);
            next();
        }).catch((error) => {
            return next(error);
        });
    });
    router.post('/pipelines', (req, res, next) => {
        Store.updatePipeline(req.body).then((response) => {
            res.json(response);
            next();
        }).catch((error) => {
            return next(error);
        });
    });
    router.put('/pipelines', (req, res, next) => {
        Store.updatePipeline(req.body).then((response) => {
            res.json(response);
            next();
        }).catch((error) => {
            return next(error);
        });
    });
    router.delete('/pipelines', (req, res, next) => {
        const name = req.query.name;
        Store.deletePipeline({ name }).then((response) => {
            res.json(response);
            next();
        }).catch((error) => {
            return next(error);
        });
    });

    return router;
};

module.exports = routes;

