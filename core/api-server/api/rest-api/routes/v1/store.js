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
        Store.getPipelines().then((response) => {
            res.json(response);
        }).catch((response) => {
            return next(error);
        });
    });
    router.get('/pipelines/:pipelineName', (req, res, next) => {
        const pipelineName = req.params.pipelineName;
        Store.getPipeline(pipelineName).then((response) => {
            res.json(response);
        }).catch((response) => {
            return next(error);
        });
    });
    router.post('/pipelines', (req, res, next) => {
        Store.updatePipeline(req.body).then((response) => {
            res.json(response);
        }).catch((response) => {
            return next(error);
        });
    });
    router.put('/pipelines', (req, res, next) => {
        Store.updatePipeline(req.body).then((response) => {
            res.json(response);
        }).catch((response) => {
            return next(error);
        });
    });
    router.delete('/pipelines/:pipelineName', (req, res, next) => {
        const pipelineName = req.params.pipelineName;
        Store.deletePipeline(pipelineName).then((response) => {
            res.json(response);
        }).catch((response) => {
            return next(error);
        });
    });

    return router;
};

module.exports = routes;

