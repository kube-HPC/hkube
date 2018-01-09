const express = require('express');
const Store = require('../../../../lib/service/StoreService');

const routes = (options) => {
    const router = express.Router();
    router.get('/', (req, res, next) => {
        res.json({ message: `${options.version} ${options.file} api` });
        next();
    });
    router.get('/pipelines', (req, res, next) => {
        const { sort } = req.query;
        Store.getPipelines({ sort }).then((response) => {
            res.json(response);
            next();
        }).catch((error) => {
            return next(error);
        });
    });
    router.get('/pipelines/:name', (req, res, next) => {
        const { name } = req.params;
        Store.getPipeline({ name }).then((response) => {
            res.json(response);
            next();
        }).catch((error) => {
            return next(error);
        });
    });
    router.post('/pipelines', (req, res, next) => {
        Store.insertPipeline(req.body).then(() => {
            res.status(201).json({ message: 'OK' });
            next();
        }).catch((error) => {
            return next(error);
        });
    });
    router.put('/pipelines', (req, res, next) => {
        Store.updatePipeline(req.body).then(() => {
            res.json({ message: 'OK' });
            next();
        }).catch((error) => {
            return next(error);
        });
    });
    router.delete('/pipelines/:name', (req, res, next) => {
        const { name } = req.params;
        Store.deletePipeline({ name }).then(() => {
            res.json({ message: 'OK' });
            next();
        }).catch((error) => {
            return next(error);
        });
    });

    return router;
};

module.exports = routes;

