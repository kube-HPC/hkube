const RestServer = require('@hkube/rest-server');
const Execution = require('../../../lib/service/execution');
const Cron = require('../../../lib/service/cron');
const Internal = require('../../../lib/service/internal');
const methods = require('../middlewares/methods');
const logger = require('../middlewares/logger');

const routes = () => {
    const router = RestServer.router();
    router.get('/', (req, res) => {
        res.json({ message: 'internal api' });
    });
    router.all('/exec/stored/cron', methods(['POST']), async (req, res) => {
        const { jobId, gateways } = await Cron.runStoredCron(req.body);
        res.json({ jobId, gateways });
    });
    router.all('/exec/stored/trigger', methods(['POST']), async (req, res) => {
        const { jobId, gateways } = await Internal.runStoredTriggerPipeline(req.body);
        res.json({ jobId, gateways });
    });
    router.all('/exec/stored/subPipeline', methods(['POST']), async (req, res) => {
        const { jobId, gateways } = await Internal.runStoredSubPipeline(req.body);
        res.json({ jobId, gateways });
    });
    router.all('/exec/raw/subPipeline', methods(['POST']), async (req, res) => {
        const { jobId, gateways } = await Internal.runRawSubPipeline(req.body);
        res.json({ jobId, gateways });
    });
    router.all('/exec/stop', methods(['POST']), async (req, res) => {
        const { jobId, reason } = req.body;
        await Execution.stopJob({ jobId, reason });
        res.json({ message: 'OK' });
    });
    router.all('/exec/clean', methods(['POST']), async (req, res) => {
        const { jobId } = req.body;
        await Execution.cleanJob({ jobId });
        res.json({ message: 'OK' });
    });
    return router;
};

module.exports = routes;
