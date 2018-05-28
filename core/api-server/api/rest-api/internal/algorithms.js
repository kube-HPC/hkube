const express = require('express');
const Algorithms = require('../../../lib/service/algorithms');
const methods = require('../middlewares/methods');
const logger = require('../middlewares/logger');

const routes = () => {
    const router = express.Router();
    router.get('/', (req, res, next) => {
        res.json({ message: 'internal api' });
        next();
    });
    router.all('/algorithms/queue', methods(['GET']), logger(), (req, res, next) => {
        Algorithms.getAlgorithmsQueueList().then((response) => {
            res.json(response);
            next();
        }).catch((error) => {
            return next(error);
        });
    });
    return router;
};

module.exports = routes;

