const RestServer = require('@hkube/rest-server');
const { keycloakRoles } = require('@hkube/consts');
const keycloak = require('../../../../lib/service/keycloak');
const Execution = require('../../../../lib/service/execution');
const pipelineStore = require('../../../../lib/service/pipelines');
const methods = require('../../middlewares/methods');

const routes = (options) => {
    const router = RestServer.router();
    router.get('/', keycloak.getProtect(keycloakRoles.API_VIEW), (req, res) => {
        res.json({ message: `${options.version} ${options.file} api` });
    });
    router.all('/results', methods(['GET']), keycloak.getProtect(keycloakRoles.API_VIEW), async (req, res) => {
        const { name, experimentName, sort, order, limit } = req.query;
        const response = await Execution.getPipelinesResult({ name, experimentName, sort, order, limit });
        res.json(response);
    });
    router.all('/status', methods(['GET']), keycloak.getProtect(keycloakRoles.API_VIEW), async (req, res) => {
        const { name, experimentName, sort, order, limit } = req.query;
        const response = await Execution.getPipelinesStatus({ name, experimentName, sort, order, limit });
        res.json(response);
    });
    router.all('/triggers/tree', methods(['GET']), keycloak.getProtect(keycloakRoles.API_VIEW), async (req, res) => {
        const { name } = req.query;
        const response = await pipelineStore.getPipelinesTriggersTree({ name });
        res.json(response);
    });
    return router;
};

module.exports = routes;
