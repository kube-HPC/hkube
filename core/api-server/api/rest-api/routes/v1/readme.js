const RestServer = require('@hkube/rest-server');
const { keycloakRoles } = require('@hkube/consts');
const multer = require('multer');
const HttpStatus = require('http-status-codes');
const readme = require('../../../../lib/service/readme');
const storage = multer.memoryStorage();
const upload = multer({ storage, fileSize: 100000 });
const fileMiddleware = upload.single('README.md');
const keycloak = require('../../../../lib/service/keycloak');

const routes = () => {
    const router = RestServer.router();
    // pipelines
    router.get('/pipelines/:name', keycloak.getProtect(keycloakRoles.API_VIEW), async (req, res) => {
        const { name } = req.params;
        const response = await readme.getPipeline({ name });
        res.json(response);
    });
    router.post('/pipelines/:name', fileMiddleware, keycloak.getProtect(keycloakRoles.API_EDIT), async (req, res) => {
        const { name } = req.params;
        const data = req.file.buffer.toString();
        await readme.insertPipeline({ name, data });
        res.status(HttpStatus.StatusCodes.CREATED).json({ message: 'OK' });
    });
    router.put('/pipelines/:name', fileMiddleware, keycloak.getProtect(keycloakRoles.API_EDIT), async (req, res) => {
        const { name } = req.params;
        const data = req.file.buffer.toString();
        await readme.updatePipeline({ name, data });
        res.json({ message: 'OK' });
    });
    router.delete('/pipelines/:name', keycloak.getProtect(keycloakRoles.API_DELETE), async (req, res) => {
        const { name } = req.params;
        await readme.deletePipeline({ name });
        res.json({ message: 'OK' });
    });
    // algorithms
    router.get('/algorithms/:name', keycloak.getProtect(keycloakRoles.API_VIEW), async (req, res) => {
        const { name } = req.params;
        const response = await readme.getAlgorithm({ name });
        res.json(response);
    });
    router.post('/algorithms/:name', fileMiddleware, keycloak.getProtect(keycloakRoles.API_EDIT), async (req, res) => {
        const { name } = req.params;
        const data = req.file.buffer.toString();
        await readme.insertAlgorithm({ name, data });
        res.status(HttpStatus.StatusCodes.CREATED).json({ message: 'OK' });
    });
    router.put('/algorithms/:name', fileMiddleware, keycloak.getProtect(keycloakRoles.API_EDIT), async (req, res) => {
        const { name } = req.params;
        const data = req.file.buffer.toString();
        await readme.updateAlgorithm({ name, data });
        res.json({ message: 'OK' });
    });
    router.delete('/algorithms/:name', keycloak.getProtect(keycloakRoles.API_EDIT), async (req, res) => {
        const { name } = req.params;
        await readme.deleteAlgorithm({ name });
        res.json({ message: 'OK' });
    });
    return router;
};

module.exports = routes;
