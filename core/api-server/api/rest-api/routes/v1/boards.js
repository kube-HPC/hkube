const express = require('express');
const boards = require('../../../../lib/service/boards');
const methods = require('../../middlewares/methods');
const logger = require('../../middlewares/logger');

const routes = (options) => {
    const router = express.Router();
    router.get('/', (req, res, next) => {
        res.json({ message: `${options.version} ${options.file} api` });
        next();
    });

    router.all('/tensor/pipeline/:pipelineName/status/:nodeName?', methods(['GET']), logger(), async (req, res, next) => {
        const { pipelineName, nodeName } = req.params;
        const response = await boards.getTensorboard({ pipelineName, nodeName }, 'node');
        res.json(response);
        next();
    });
    router.all('/tensor/pipeline/:pipelineName/stop/:nodeName?', methods(['DELETE']), logger(), async (req, res, next) => {
        const { pipelineName, nodeName } = req.params;
        await boards.stopTensorboard({ pipelineName, nodeName }, 'node');
        res.json({ message: 'OK' });
        next();
    });
    router.all('/tensor/pipeline/:pipelineName/start/:nodeName?', methods(['POST']), logger(), async (req, res, next) => {
        const { pipelineName, nodeName } = req.params;
        const methodOptions = { pipelineName, nodeName };
        await boards.startTensorboard(methodOptions, 'node');
        res.json({ message: 'OK' });
        next();
    });
    router.all('/tensor/node/:nodeName/status/:jobId?', methods(['GET']), logger(), async (req, res, next) => {
        const { nodeName, jobId } = req.params;
        const response = await boards.getTensorboard({ nodeName, jobId }, 'batch');
        res.json(response);
        next();
    });
    router.all('/tensor/node/:nodeName/stop/:jobId?', methods(['DELETE']), logger(), async (req, res, next) => {
        const { nodeName, jobId } = req.params;
        await boards.stopTensorboard({ nodeName, jobId }, 'batch');
        res.json({ message: 'OK' });
        next();
    });
    router.all('/tensor/node/:nodeName/start/:jobId?', methods(['POST']), logger(), async (req, res, next) => {
        const { nodeName, jobId } = req.params;
        const { pipelineName } = req.body;
        await boards.startTensorboard({ nodeName, jobId, pipelineName }, 'batch');
        res.json({ message: 'OK' });
        next();
    });
    router.all('/tensor/status/:taskId?', methods(['GET']), logger(), async (req, res, next) => {
        const { taskId } = req.params;
        const response = await boards.getTensorboard({ taskId }, 'task');
        res.json(response);
        next();
    });
    router.all('/tensor/stop/:taskId?', methods(['DELETE']), logger(), async (req, res, next) => {
        const { taskId } = req.params;
        await boards.stopTensorboard({ taskId }, 'task');
        res.json({ message: 'OK' });
        next();
    });
    router.all('/tensor/start/:taskId?', methods(['POST']), logger(), async (req, res, next) => {
        const { taskId } = req.params;
        const { nodeName, pipelineName } = req.body;
        await boards.startTensorboard({ taskId, nodeName, pipelineName }, 'task');
        res.json({ message: 'OK' });
        next();
    });

    return router;
};

module.exports = routes;
