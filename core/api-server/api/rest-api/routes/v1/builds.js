const express = require('express');
const builds = require('../../../../lib/service/builds');
const methods = require('../../middlewares/methods');
const logger = require('../../middlewares/logger');

const routes = (options) => {
    const router = express.Router();
    router.get('/', (req, res, next) => {
        res.json({ message: `${options.version} ${options.file} api` });
        next();
    });
    router.all('/status/:buildId?', methods(['GET']), logger(), (req, res, next) => {
        const { buildId } = req.params;
        builds.getBuild({ buildId }).then((response) => {
            res.json(response);
            next();
        }).catch((error) => {
            return next(error);
        });
    });
    router.all('/list/:name?', methods(['GET']), logger(), (req, res, next) => {
        const { name } = req.params;
        const { sort, order, limit } = req.query;
        builds.getBuilds({ name, sort, order, limit }).then((response) => {
            res.json(response);
            next();
        }).catch((error) => {
            return next(error);
        });
    });
    router.all('/stop', methods(['POST']), logger(), (req, res, next) => {
        const { buildId } = req.body;
        builds.stopBuild({ buildId }).then(() => {
            res.json({ message: 'OK' });
            next();
        }).catch((error) => {
            return next(error);
        });
    });
    router.all('/rerun', methods(['POST']), logger(), (req, res, next) => {
        const { buildId } = req.body;
        builds.rerunBuild({ buildId }).then(() => {
            res.json({ message: 'OK' });
            next();
        }).catch((error) => {
            return next(error);
        });
    });
    return router;
};

module.exports = routes;
