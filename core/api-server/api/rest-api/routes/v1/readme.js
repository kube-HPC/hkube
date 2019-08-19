const express = require('express');
const multer = require('multer');
const HttpStatus = require('http-status-codes');
const logger = require('../../middlewares/logger');
const readme = require('../../../../lib/service/readme');
const storage = multer.memoryStorage();
const upload = multer({ storage, fileSize: 100000 });

const routes = () => {
    const router = express.Router();
    // pipelines
    router.get('/pipelines/:name', logger(), async (req, res, next) => {
        const { name } = req.params;
        const response = await readme.getPipeline({ name });
        res.json(response);
        next();
    });
    router.post('/pipelines/:name', upload.single('README.md'), logger(), async (req, res, next) => {
        const { name } = req.params;
        const data = req.file.buffer.toString();
        const response = await readme.insertPipeline({ name, data });
        res.status(HttpStatus.CREATED).json(response);
        next();
    });
    router.put('/pipelines/:name', upload.single('README.md'), logger(), async (req, res, next) => {
        const { name } = req.params;
        const data = req.file.buffer.toString();
        const response = await readme.updatePipeline({ name, data });
        res.json(response);
        next();
    });
    router.delete('/pipelines/:name', logger(), async (req, res, next) => {
        const { name } = req.params;
        await readme.deletePipeline({ name });
        res.json({ message: 'OK' });
        next();
    });
    // algorithms
    router.get('/algorithms/:name', logger(), async (req, res, next) => {
        const { name } = req.params;
        const response = await readme.getAlgorithm({ name });
        res.json(response);
        next();
    });
    router.post('/algorithms/:name', upload.single('README.md'), logger(), async (req, res, next) => {
        const { name } = req.params;
        const data = req.file.buffer.toString();
        const response = await readme.insertAlgorithm({ name, data });
        res.status(HttpStatus.CREATED).json(response);
        next();
    });
    router.put('/algorithms/:name', upload.single('README.md'), logger(), async (req, res, next) => {
        const { name } = req.params;
        const data = req.file.buffer.toString();
        const response = await readme.updateAlgorithm({ name, data });
        res.status(HttpStatus.CREATED).json(response);
        next();
    });
    router.delete('/algorithms/:name', logger(), async (req, res, next) => {
        const { name } = req.params;
        await readme.deleteAlgorithm({ name });
        res.json({ message: 'OK' });
        next();
    });
    return router;
};

module.exports = routes;
