const express = require('express');
const boards = require('../../../../lib/service/boards');
const logger = require('../../middlewares/logger');

const routes = (options) => {
    const router = express.Router();
    router.get('/', (req, res, next) => {
        res.json({ message: `${options.version} ${options.file} api` });
        next();
    });
    router.get('/tensors', logger(), async (req, res, next) => {
        const response = await boards.getTensorboards();
        res.json(response);
        next();
    });
    router.get('/tensors/:id?', logger(), async (req, res, next) => {
        const { id } = req.params;
        const response = await boards.getTensorboard({ id });
        res.json(response);
        next();
    });
    router.delete('/tensors/:id?', logger(), async (req, res, next) => {
        const { id } = req.params;
        await boards.stopTensorboard({ id });
        res.json({ message: 'Board deleted' });
        next();
    });
    router.post('/tensors/', logger(), async (req, res, next) => {
        const { nodeName, pipelineName, jobId, taskId } = req.body;
        const id = await boards.startTensorboard({ taskId, jobId, nodeName, pipelineName });
        const message = 'Board started successfully';
        res.json({ id, message });
        next();
    });

    return router;
};

module.exports = routes;
