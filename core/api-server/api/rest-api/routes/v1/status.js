const express = require('express');
const logger = require('../../middlewares/logger');

const routes = (options) => {
    const router = express.Router();
    router.get('/', (req, res, next) => {
        res.json({ message: `${options.version} ${options.file} api` });
        next();
    });
    router.get('/version', logger(), async (req, res, next) => {
        const version = {
            systemVersion: options.systemVersion,
            clusterName: options.clusterName,
            storage: options.defaultStorage,
        };
        res.json(version);
        next();
    });
    return router;
};

module.exports = routes;
