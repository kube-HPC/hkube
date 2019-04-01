const express = require('express');
const multer = require('multer');
const pipelineStore = require('../../../../lib/service/pipelines');
const algorithmStore = require('../../../../lib/service/algorithms');
const logger = require('../../middlewares/logger');

const upload = multer({ dest: 'uploads/zipped/' });

const routes = (options) => {
    const router = express.Router();
    router.get('/', (req, res, next) => {
        res.json({ message: `${options.version} ${options.file} api` });
        next();
    });

    // pipelines
    router.get('/pipelines', logger(), (req, res, next) => {
        const { sort } = req.query;
        pipelineStore.getPipelines({ sort }).then((response) => {
            res.json(response);
            next();
        }).catch((error) => {
            return next(error);
        });
    });
    router.get('/pipelines/:name', logger(), (req, res, next) => {
        const { name } = req.params;
        pipelineStore.getPipeline({ name }).then((response) => {
            res.json(response);
            next();
        }).catch((error) => {
            return next(error);
        });
    });
    router.post('/pipelines', logger(), (req, res, next) => {
        pipelineStore.insertPipeline(req.body).then((response) => {
            res.status(201).json(response);
            next();
        }).catch((error) => {
            return next(error);
        });
    });
    router.put('/pipelines', logger(), (req, res, next) => {
        pipelineStore.updatePipeline(req.body).then((response) => {
            res.json(response);
            next();
        }).catch((error) => {
            return next(error);
        });
    });
    router.delete('/pipelines/:name', logger(), (req, res, next) => {
        const { name } = req.params;
        pipelineStore.deletePipeline({ name }).then(() => {
            res.json({ message: 'OK' });
            next();
        }).catch((error) => {
            return next(error);
        });
    });
    // pipelines

    // algorithms
    router.get('/algorithms', logger(), (req, res, next) => {
        const { sort } = req.query;
        algorithmStore.getAlgorithms({ sort }).then((response) => {
            res.json(response);
            next();
        }).catch((error) => {
            return next(error);
        });
    });
    router.get('/algorithms/:name', logger(), (req, res, next) => {
        const { name } = req.params;
        algorithmStore.getAlgorithm({ name }).then((response) => {
            res.json(response);
            next();
        }).catch((error) => {
            return next(error);
        });
    });
    router.post('/algorithms', logger(), (req, res, next) => {
        algorithmStore.insertAlgorithm(req.body).then((response) => {
            res.status(201).json(response);
            next();
        }).catch((error) => {
            return next(error);
        });
    });
    router.post('/algorithms/debug', logger(), (req, res, next) => {
        algorithmStore.insertAlgorithm({ ...req.body, options: { debug: true } }).then((response) => {
            res.status(201).json(response);
            next();
        }).catch((error) => {
            return next(error);
        });
    });
    router.put('/algorithms', logger(), (req, res, next) => {
        algorithmStore.updateAlgorithm(req.body).then((response) => {
            res.json(response);
            next();
        }).catch((error) => {
            return next(error);
        });
    });
    router.delete('/algorithms/:name', logger(), (req, res, next) => {
        const { name } = req.params;
        algorithmStore.deleteAlgorithm({ name }).then(() => {
            res.json({ message: 'OK' });
            next();
        }).catch((error) => {
            return next(error);
        });
    });
    router.delete('/algorithms/debug/:name', logger(), (req, res, next) => {
        const { name } = req.params;
        algorithmStore.deleteAlgorithm({ name }).then(() => {
            res.json({ message: 'OK' });
            next();
        }).catch((error) => {
            return next(error);
        });
    });
    router.post('/algorithms/apply', upload.single('file'), logger(), (req, res, next) => {
        const body = (req.body.payload) || null;
        const file = req.file || {};
        const payload = JSON.parse(body);
        algorithmStore.applyAlgorithm({ payload, file: { path: file.path, name: file.originalname } }).then((response) => {
            res.json(response);
            next();
        }).catch((error) => {
            return next(error);
        });
    });
    // algorithms

    return router;
};

module.exports = routes;
