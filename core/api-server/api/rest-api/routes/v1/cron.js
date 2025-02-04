const RestServer = require('@hkube/rest-server');
const { keycloakRoles } = require('@hkube/consts');
const Cron = require('../../../../lib/service/cron');
const methods = require('../../middlewares/methods');
const keycloak = require('../../../../lib/service/keycloak');

const routes = (options) => {
    const router = RestServer.router();
    router.get('/', keycloak.getProtect(keycloakRoles.API_VIEW), (req, res) => {
        res.json({ message: `${options.version} ${options.file} api` });
    });
    router.all('/results', methods(['GET']), keycloak.getProtect(keycloakRoles.API_VIEW), async (req, res) => {
        const { experimentName, name, sort, order, limit } = req.query;
        const response = await Cron.getCronResult({ experimentName, name, sort, order, limit });
        res.json(response);
    });
    router.all('/status', methods(['GET']), keycloak.getProtect(keycloakRoles.API_VIEW), async (req, res) => {
        const { experimentName, name, sort, order, limit } = req.query;
        const response = await Cron.getCronStatus({ experimentName, name, sort, order, limit });
        res.json(response);
    });
    router.all('/list/:name?', methods(['GET']), keycloak.getProtect(keycloakRoles.API_VIEW), async (req, res) => {
        const { sort, order, limit } = req.query;
        const response = await Cron.getCronList({ sort, order, limit });
        res.json(response);
    });
    router.post('/start', keycloak.getProtect(keycloakRoles.API_VIEW), async (req, res) => {
        const { name, pattern } = req.body;
        await Cron.startCronJob({ name, pattern });
        res.json({ message: 'OK' });
    });
    router.post('/stop', keycloak.getProtect(keycloakRoles.API_VIEW), async (req, res) => {
        const { name, pattern } = req.body;
        await Cron.stopCronJob({ name, pattern });
        res.json({ message: 'OK' });
    });

    return router;
};

module.exports = routes;
