const RestServer = require('@hkube/rest-server');
const Cron = require('../../../../lib/service/cron');
const methods = require('../../middlewares/methods');

const routes = (options) => {
    const router = RestServer.router();
    router.get('/', (req, res) => {
        res.json({ message: `${options.version} ${options.file} api` });
    });
    router.all('/results', methods(['GET']), async (req, res) => {
        const { experimentName, name, sort, order, limit } = req.query;
        const response = await Cron.getCronResult({ experimentName, name, sort, order, limit });
        res.json(response);
    });
    router.all('/status', methods(['GET']), async (req, res) => {
        const { experimentName, name, sort, order, limit } = req.query;
        const response = await Cron.getCronStatus({ experimentName, name, sort, order, limit });
        res.json(response);
    });
    router.all('/list/:name?', methods(['GET']), async (req, res) => {
        const { sort, order, limit } = req.query;
        const response = await Cron.getCronList({ sort, order, limit });
        res.json(response);
    });
    router.all('/start', methods(['POST']), async (req, res) => {
        const { name, pattern } = req.body;
        await Cron.startCronJob({ name, pattern });
        res.json({ message: 'OK' });
    });
    router.all('/stop', methods(['POST']), async (req, res) => {
        const { name, pattern } = req.body;
        await Cron.stopCronJob({ name, pattern });
        res.json({ message: 'OK' });
    });
    return router;
};

module.exports = routes;
