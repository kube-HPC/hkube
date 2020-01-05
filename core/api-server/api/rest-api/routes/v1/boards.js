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

    router.all('/tensor/pipeline/:pipeline/node/:node/status?', methods(['GET']), logger(), async (req, res, next) => {
        const { name } = req.params;
        const response = await boards.getTensorboard({ name });
        res.json(response);
        next();
    });
    router.all('/tensor/pipeline/:pipeline/node/:node/stop?', methods(['PUT']), logger(), async (req, res, next) => {
        const { name } = req.params;
        await boards.stopTensorboard({ name });
        res.json({ message: 'OK' });
        next();
    });
    router.all('/tensor/pipeline/:pipeline/node/:node/start?', methods(['POST']), logger(), async (req, res, next) => {
        const methodOptions = { name: req.params.name, pipelineName: req.body.pipelineName, nodeName: req.body.nodeName, jobId: req.body.jobId, taskId: req.body.taskId };
        await boards.startTensorboard(methodOptions);
        res.json({ message: 'OK' });
        next();
    });



    router.all('/tensor/batch/status/:id?', methods(['GET']), logger(), async (req, res, next) => {
        const { name } = req.params;
        const response = await boards.getTensorboard({ name });
        res.json(response);
        next();
    });
    router.all('/tensor/batch/stop/:id?', methods(['PUT']), logger(), async (req, res, next) => {
        const { name } = req.params;
        await boards.stopTensorboard({ name });
        res.json({ message: 'OK' });
        next();
    });
    router.all('/tensor/batch/start/:id?', methods(['POST']), logger(), async (req, res, next) => {
        const methodOptions = { name: req.params.name, pipelineName: req.body.pipelineName, nodeName: req.body.nodeName, jobId: req.body.jobId, taskId: req.body.taskId };
        await boards.startTensorboard(methodOptions);
        res.json({ message: 'OK' });
        next();
    });


    router.all('/tensor/task/status/:id?', methods(['GET']), logger(), async (req, res, next) => {
        const { name } = req.params;
        const response = await boards.getTensorboard({ name });
        res.json(response);
        next();
    });
    router.all('/tensor/task/stop/:id?', methods(['PUT']), logger(), async (req, res, next) => {
        const { name } = req.params;
        await boards.stopTensorboard({ name });
        res.json({ message: 'OK' });
        next();
    });
    router.all('/tensor/task/start/:id?', methods(['POST']), logger(), async (req, res, next) => {
        const methodOptions = { name: req.params.name, pipelineName: req.body.pipelineName, nodeName: req.body.nodeName, jobId: req.body.jobId, taskId: req.body.taskId };
        await boards.startTensorboard(methodOptions);
        res.json({ message: 'OK' });
        next();
    });

    return router;
};

module.exports = routes;
