const express = require('express');
const multer = require('multer');
const logger = require('../../middlewares/logger');
const readme = require('../../../../lib/service/readme');

const storage = multer.memoryStorage();
const upload = multer({ storage, fileSize: 100000 });

const routes = () => {
    const router = express.Router();
    // pipelines
    router.get('/pipelines/:name', logger(), (req, res, next) => {
        const { name } = req.params;
        readme.getPipeline({ name }).then((response) => {
            res.json(response);
            next();
        }).catch((error) => {
            return next(error);
        });
    });
    router.post('/pipelines/:name', upload.single('README.md'), logger(), (req, res, next) => {
        const { name } = req.params;
        const data = req.file.buffer.toString();
        readme.insertPipeline({ name, data }).then((response) => {
            res.status(201).json(response);
            next();
        }).catch((error) => {
            return next(error);
        });
    });
    router.put('/pipelines/:name', upload.single('README.md'), logger(), async (req, res, next) => {
        const { name } = req.params;
        const data = req.file.buffer.toString();
        readme.updatePipeline({ name, data }).then((response) => {
            res.json(response);
            next();
        }).catch((error) => {
            return next(error);
        });
    });
    router.delete('/pipelines/:name', logger(), async (req, res, next) => {
        const { name } = req.params;
        readme.deletePipeline({ name }).then(() => {
            res.json({ message: 'OK' });
            next();
        }).catch((error) => {
            return next(error);
        });
    });
    // algorithms
    router.get('/algorithms/:name', logger(), (req, res, next) => {
        const { name } = req.params;
        readme.getAlgorithm({ name }).then((response) => {
            res.json(response);
            next();
        }).catch((error) => {
            return next(error);
        });
    });
    router.post('/algorithms/:name', upload.single('README.md'), logger(), async (req, res, next) => {
        const { name } = req.params;
        readme.insertAlgorithm({ name }).then((response) => {
            res.status(201).json(response);
            next();
        }).catch((error) => {
            return next(error);
        });
    });
    router.put('/algorithms/:name', upload.single('README.md'), logger(), async (req, res, next) => {
        const { name } = req.params;
        const data = req.file.buffer.toString();
        readme.updateAlgorithm({ name, data }).then((response) => {
            res.status(201).json(response);
            next();
        }).catch((error) => {
            return next(error);
        });
    });
    router.delete('/algorithms/:name', logger(), async (req, res, next) => {
        const { name } = req.params;
        readme.deleteAlgorithm({ name }).then(() => {
            res.json({ message: 'OK' });
            next();
        }).catch((error) => {
            return next(error);
        });
    });
    return router;
};

module.exports = routes;
