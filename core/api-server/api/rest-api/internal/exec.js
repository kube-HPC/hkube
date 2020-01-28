const express = require('express');
const Execution = require('../../../lib/service/execution');
const Cron = require('../../../lib/service/cron');
const Internal = require('../../../lib/service/internal');
const methods = require('../middlewares/methods');
const logger = require('../middlewares/logger');

const routes = () => {
    const router = express.Router();
    router.get('/', (req, res, next) => {
        res.json({ message: 'internal api' });
        next();
    });
    router.all('/exec/stored/cron', methods(['POST']), logger(), async (req, res, next) => {
        const jobId = await Cron.runStoredCron(req.body);
        res.json({ jobId });
        res.jobId = jobId;
        next();
    });
    router.all('/exec/stored/trigger', methods(['POST']), logger(), async (req, res, next) => {
        const jobId = await Internal.runStoredTriggerPipeline(req.body);
        res.json({ jobId });
        res.jobId = jobId;
        next();
    });
    router.all('/exec/stored/subPipeline', methods(['POST']), logger(), async (req, res, next) => {
        const jobId = await Internal.runStoredSubPipeline(req.body);
        res.json({ jobId });
        res.jobId = jobId;
        next();
    });
    router.all('/exec/raw/subPipeline', methods(['POST']), logger(), async (req, res, next) => {
        const jobId = await Internal.runRawSubPipeline(req.body);
        res.json({ jobId });
        res.jobId = jobId;
        next();
    });
    router.all('/exec/stop', methods(['POST']), logger(), async (req, res, next) => {
        const { jobId, reason } = req.body;
        await Execution.stopJob({ jobId, reason });
        res.json({ message: 'OK' });
        res.jobId = jobId;
        next();
    });
    router.all('/exec/clean', methods(['POST']), logger(), async (req, res, next) => {
        const { jobId } = req.body;
        await Execution.cleanJob({ jobId });
        res.json({ message: 'OK' });
        res.jobId = jobId;
        next();
    });

    return router;
};

module.exports = routes;
