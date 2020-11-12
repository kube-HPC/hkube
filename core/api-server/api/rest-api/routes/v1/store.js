const express = require('express');
const fse = require('fs-extra');
const multer = require('multer');
const HttpStatus = require('http-status-codes');
const pipelineStore = require('../../../../lib/service/pipelines');
const algorithmStore = require('../../../../lib/service/algorithms');
const logger = require('../../middlewares/logger');
const upload = multer({ dest: 'uploads/zipped/' });

const routes = (option) => {
    const router = express.Router();
    router.get('/', (req, res, next) => {
        res.json({ message: `${option.version} ${option.file} api` });
        next();
    });

    // pipelines
    router.get('/pipelines', logger(), async (req, res, next) => {
        const { sort } = req.query;
        const response = await pipelineStore.getPipelines({ sort });
        res.json(response);
        next();
    });
    router.get('/pipelines/:name', logger(), async (req, res, next) => {
        const { name } = req.params;
        const response = await pipelineStore.getPipeline({ name });
        res.json(response);
        next();
    });
    router.post('/pipelines', logger(), async (req, res, next) => {
        const response = await pipelineStore.insertPipeline(req.body);
        res.status(HttpStatus.CREATED).json(response);
        next();
    });
    router.put('/pipelines', logger(), async (req, res, next) => {
        const response = await pipelineStore.updatePipeline(req.body);
        res.json(response);
        next();
    });
    router.delete('/pipelines/:name', logger(), async (req, res, next) => {
        const { name } = req.params;
        const message = await pipelineStore.deletePipeline({ name });
        res.json({ message });
        next();
    });
    // pipelines

    // algorithms
    router.get('/algorithms', logger(), async (req, res, next) => {
        const { name, sort, limit } = req.query;
        const response = await algorithmStore.getAlgorithms({ name, sort, limit });
        res.json(response);
        next();
    });
    router.get('/algorithms/:name', logger(), async (req, res, next) => {
        const { name } = req.params;
        const response = await algorithmStore.getAlgorithm({ name });
        res.json(response);
        next();
    });
    router.post('/algorithms', logger(), async (req, res, next) => {
        const response = await algorithmStore.insertAlgorithm(req.body);
        res.status(HttpStatus.CREATED).json(response);
        next();
    });
    router.post('/algorithms/debug', logger(), async (req, res, next) => {
        const algorithm = req.body;
        const debug = {
            ...algorithm,
            options: { debug: true }
        };
        const response = await algorithmStore.insertAlgorithm(debug);
        res.status(HttpStatus.CREATED).json(response);
        next();
    });
    router.put('/algorithms', logger(), async (req, res, next) => {
        const response = await algorithmStore.updateAlgorithm(req.body);
        res.json(response);
        next();
    });
    router.delete('/algorithms/:name', logger(), async (req, res, next) => {
        const { name } = req.params;
        const { force } = req.query;
        const message = await algorithmStore.deleteAlgorithm({ name, force });
        res.json({ message });
        next();
    });
    router.delete('/algorithms/debug/:name', logger(), async (req, res, next) => {
        const { name } = req.params;
        await algorithmStore.deleteAlgorithm({ name });
        res.json({ message: 'OK' });
        next();
    });
    router.post('/algorithms/apply', upload.single('file'), logger(), async (req, res, next) => {
        const { file } = req;
        try {
            const bodyPayload = (req.body.payload) || '{}';
            const bodyOptions = (req.body.options) || '{}';
            const payload = JSON.parse(bodyPayload);
            const options = JSON.parse(bodyOptions);
            const response = await algorithmStore.applyAlgorithm({ options, payload, file });
            res.json(response);
            next();
        }
        finally {
            if (file?.path) {
                await fse.remove(file.path);
            }
        }
    });
    // algorithms

    return router;
};

module.exports = routes;
