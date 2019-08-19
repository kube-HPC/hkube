const express = require('express');
const multer = require('multer');
const HttpStatus = require('http-status-codes');
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
        await pipelineStore.deletePipeline({ name });
        res.json({ message: 'OK' });
        next();
    });
    // pipelines

    // algorithms
    router.get('/algorithms', logger(), async (req, res, next) => {
        const { sort } = req.query;
        const response = await algorithmStore.getAlgorithms({ sort });
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
        const response = await algorithmStore.insertAlgorithm({ ...req.body, options: { debug: true } });
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
        await algorithmStore.deleteAlgorithm({ name });
        res.json({ message: 'OK' });
        next();
    });
    router.delete('/algorithms/debug/:name', logger(), async (req, res, next) => {
        const { name } = req.params;
        await algorithmStore.deleteAlgorithm({ name });
        res.json({ message: 'OK' });
        next();
    });
    router.post('/algorithms/apply', upload.single('file'), logger(), async (req, res, next) => {
        const body = (req.body.payload) || null;
        const file = req.file || {};
        const payload = JSON.parse(body);
        const response = await algorithmStore.applyAlgorithm({ payload, file: { path: file.path, name: file.originalname } });
        res.json(response);
        next();
    });
    // algorithms

    return router;
};

module.exports = routes;
