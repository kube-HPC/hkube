const RestServer = require('@hkube/rest-server');
const { keycloakRoles } = require('@hkube/consts');
const boards = require('../../../../lib/service/boards');
const keycloak = require('../../../../lib/service/keycloak');

const routes = (options) => {
    const router = RestServer.router();
    router.get('/', keycloak.getProtect(keycloakRoles.API_VIEW), (req, res) => {
        res.json({ message: `${options.version} ${options.file} api` });
    });
    router.get('/tensors', keycloak.getProtect(keycloakRoles.API_VIEW), async (req, res) => {
        const response = await boards.getTensorboards();
        res.json(response);
    });
    router.get('/tensors/:id?', keycloak.getProtect(keycloakRoles.API_VIEW), async (req, res) => {
        const { id } = req.params;
        const response = await boards.getTensorboard({ id });
        res.json(response);
    });
    router.delete('/tensors/:id?', keycloak.getProtect(keycloakRoles.API_DELETE), async (req, res) => {
        const { id } = req.params;
        await boards.stopTensorboard({ id });
        res.json({ message: 'Board deleted' });
    });
    router.post('/tensors/', keycloak.getProtect(keycloakRoles.API_VIEW), async (req, res) => {
        const { nodeName, pipelineName, jobId, taskId } = req.body;
        const id = await boards.startTensorboard({ taskId, jobId, nodeName, pipelineName });
        const message = 'Board started successfully';
        res.json({ id, message });
    });

    router.get('/optunas', keycloak.getProtect(keycloakRoles.API_VIEW), async (req, res) => {
        const response = await boards.getOptunaboards();
        res.json(response);
    });
    router.get('/optunas/:id?', keycloak.getProtect(keycloakRoles.API_VIEW), async (req, res) => {
        const { id } = req.params;
        const response = await boards.getOptunaboard({ id });
        res.json(response);
    });
    router.delete('/optunas/:id?', keycloak.getProtect(keycloakRoles.API_VIEW), async (req, res) => {
        const { id } = req.params;
        await boards.stopOptunaboard({ id });
        res.json({ message: 'Board deleted' });
    });
    router.post('/optunas/', keycloak.getProtect(keycloakRoles.API_VIEW), async (req, res) => {
        const { jobId } = req.body;
        const boardUrl = await boards.startOptunaboard({ jobId });
        const message = 'Board started successfully';
        res.json({ id: jobId, message, boardUrl });
    });

    return router;
};

module.exports = routes;
