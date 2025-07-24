const RestServer = require('@hkube/rest-server');
const { keycloakRoles } = require('@hkube/consts');
const HttpStatus = require('http-status-codes');
const algoVersionsService = require('../../../../lib/service/algorithm-versions');
const pipelineVersionsService = require('../../../../lib/service/pipeline-versions');
const keycloak = require('../../../../lib/service/keycloak');

const routes = (options) => {
    const router = RestServer.router();
    router.get('/', keycloak.getProtect(keycloakRoles.API_VIEW), (req, res) => {
        res.json({ message: `${options.version} ${options.file} api` });
    });
    // Algorithms
    router.get('/algorithms/:name', keycloak.getProtect(keycloakRoles.API_VIEW), async (req, res) => {
        const { name } = req.params;
        const { sort, order, limit } = req.query;
        const response = await algoVersionsService.getVersions({ name, sort, order, limit });
        res.json(response);
    });
    router.get('/algorithms/:name/:version', keycloak.getProtect(keycloakRoles.API_VIEW), async (req, res) => {
        const response = await algoVersionsService.getVersion(req.params);
        res.json(response);
    });
    router.post('/algorithms/apply', keycloak.getProtect(keycloakRoles.API_EDIT), async (req, res) => {
        const userName = keycloak.getPreferredUsername(req);
        const response = await algoVersionsService.applyVersion(req.body, userName);
        res.status(HttpStatus.StatusCodes.CREATED).json(response);
    });
    router.post('/algorithms/tag', keycloak.getProtect(keycloakRoles.API_EDIT), async (req, res) => {
        const response = await algoVersionsService.tagVersion(req.body);
        res.status(HttpStatus.StatusCodes.CREATED).json(response);
    });
    router.delete('/algorithms/:name/:version', keycloak.getProtect(keycloakRoles.API_DELETE), async (req, res) => {
        const response = await algoVersionsService.deleteVersion(req.params);
        res.json(response);
    });
    router.put('/algorithms/alias', keycloak.getProtect(keycloakRoles.API_EDIT), async (req, res) => {
        const response = await algoVersionsService.updateVersionAlias(req.body);
        res.json(response);
    });

    // Pipelines
    router.get('/pipelines/:name', keycloak.getProtect(keycloakRoles.API_VIEW), async (req, res) => {
        const { name } = req.params;
        const { sort, order, limit } = req.query;
        const response = await pipelineVersionsService.getVersions({ name, sort, order, limit });
        res.json(response);
    });
    router.get('/pipelines/:name/:version', keycloak.getProtect(keycloakRoles.API_VIEW), async (req, res) => {
        const response = await pipelineVersionsService.getVersion(req.params);
        res.json(response);
    });
    router.post('/pipelines/apply', keycloak.getProtect(keycloakRoles.API_EDIT), async (req, res) => {
        const userName = keycloak.getPreferredUsername(req);
        const response = await pipelineVersionsService.applyVersion(req.body, userName);
        res.status(HttpStatus.StatusCodes.CREATED).json(response);
    });
    router.delete('/pipelines/:name/:version', keycloak.getProtect(keycloakRoles.API_DELETE), async (req, res) => {
        const response = await pipelineVersionsService.deleteVersion(req.params);
        res.json(response);
    });
    router.put('/pipelines/alias', keycloak.getProtect(keycloakRoles.API_EDIT), async (req, res) => {
        const response = await pipelineVersionsService.updateVersionAlias(req.body);
        res.json(response);
    });

    return router;
};

module.exports = routes;
