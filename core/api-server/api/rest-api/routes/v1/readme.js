const express = require('express');
const multer = require('multer');
const storageManager = require('@hkube/storage-manager');
const logger = require('../../middlewares/logger');
const pipelineStore = require('../../../../lib/service/pipelines');
const algorithmStore = require('../../../../lib/service/algorithms');

const storage = multer.memoryStorage();
const upload = multer({ storage, fileSize: 100000 });

const isPipelineAvailable = async (name) => {
    try {
        await pipelineStore.getPipeline({ name });
        return true;
    }
    catch (error) {
        return false;
    }
};

const isAlgorithmAvailable = async (name) => {
    try {
        await algorithmStore.getAlgorithm({ name });
        return true;
    }
    catch (error) {
        return false;
    }
};
const routes = () => {
    const router = express.Router();
    // pipelines
    router.get('/pipelines/:name', logger(), async (req, res, next) => {
        try {
            const { name } = req.params;
            if (await isPipelineAvailable(name)) {
                const data = await storageManager.hkubeStore.get({ type: 'readme/pipeline', name });
                res.json(data);
            }
            return next();
        }
        catch (error) {
            return next(error);
        }
    });
    router.post('/pipelines/:name', upload.single('README.md'), logger(), async (req, res, next) => {
        const { name } = req.params;
        try {
            if (req.file && await isPipelineAvailable(name)) {
                const data = await storageManager.hkubeStore.put({ type: 'readme/pipeline', name, data: { readme: req.file.buffer.toString() } });
                res.status(201).json(data);
                return next();
            }

            res.status(400).json({ message: 'one of your inputs are incorrect please verify that there is pipeline with that name and that the file name is README.md' });
            return next();
        }
        catch (error) {
            return next(error);
        }
    });
    router.put('/pipelines/:name', upload.single('README.md'), logger(), async (req, res, next) => {
        const { name } = req.params;
        try {
            if (req.file && await isPipelineAvailable(name)) {
                const data = await storageManager.hkubeStore.put({ type: 'readme/pipeline', name, data: { readme: req.file.buffer.toString() } });
                res.status(201).json(data);
            }

            res.status(400).json({ message: 'one of your inputs are incorrect please verify that there is pipeline with that name and that the file name is README.md' });
            return next();
        }
        catch (error) {
            return next(error);
        }
    });
    router.delete('/pipelines/:name', logger(), async (req, res, next) => {
        const { name } = req.params;
        try {
            if (await isPipelineAvailable(name)) {
                await storageManager.hkubeStore.delete({ type: 'readme/pipeline', name });
                res.json({ message: 'OK' });
            }
            return next();
        }
        catch (error) {
            return next(error);
        }
    });
    // algorithms
    router.get('/algorithms/:name', logger(), async (req, res, next) => {
        try {
            const { name } = req.params;
            if (await isAlgorithmAvailable(name)) {
                const data = await storageManager.hkubeStore.get({ type: 'readme/algorithms', name });
                res.json(data);
            }
            return next();
        }
        catch (error) {
            return next(error);
        }
    });
    router.post('/algorithms/:name', upload.single('README.md'), logger(), async (req, res, next) => {
        const { name } = req.params;
        try {
            if (req.file && await isAlgorithmAvailable(name)) {
                await storageManager.hkubeStore.put({ type: 'readme/algorithms', name, data: { readme: req.file.buffer.toString() } });
                res.status(201);
            }
            else {
                res.status(400).json({ message: 'one of your inputs are incorrect please verify that there is algorithm with that name and that the file name is README.md' });
            }
            return next();
        }
        catch (error) {
            return next(error);
        }
    });
    router.put('/algorithms/:name', upload.single('README.md'), logger(), async (req, res, next) => {
        const { name } = req.params;
        try {
            if (req.file && await isAlgorithmAvailable(name)) {
                const data = await storageManager.hkubeStore.put({ type: 'readme/algorithms', name, data: { readme: req.file.buffer.toString() } });
                res.status(201).json(data);
            }
            else {
                res.status(400).json({ message: 'one of your inputs are incorrect please verify that there is algorithm with that name and that the file name is README.md' });
            }
            return next();
        }
        catch (error) {
            return next(error);
        }
    });
    router.delete('/algorithms/:name', logger(), async (req, res, next) => {
        const { name } = req.params;
        try {
            if (await isAlgorithmAvailable(name)) {
                await storageManager.hkubeStore.delete({ type: 'readme/algorithms', name, data: { readme: req.file.buffer.toString() } });
                res.json({ message: 'OK' });
            }
            return next();
        }
        catch (error) {
            return next(error);
        }
    });
    return router;
};

module.exports = routes;
