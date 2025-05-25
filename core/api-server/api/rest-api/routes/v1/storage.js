const RestServer = require('@hkube/rest-server');
const { keycloakRoles } = require('@hkube/consts');
const storage = require('../../../../lib/service/storage');
const {
    handleStorageError,
    handleStreamError,
    promisifyStream,
    downloadApi
} = require('../../../../lib/stream');
const keycloak = require('../../../../lib/service/keycloak');

const routes = (options) => {
    const router = RestServer.router();

    router.get('/', keycloak.getProtect(keycloakRoles.API_VIEW), (req, res, next) => {
        res.json({ message: `${options.version} ${options.file} api` });
        next();
    });
    router.get('/info', keycloak.getProtect(keycloakRoles.API_VIEW), async (req, res, next) => {
        const response = await storage.getInfo();
        res.json(response);
        next();
    });
    router.get('/prefix/types', keycloak.getProtect(keycloakRoles.API_VIEW), (req, res, next) => {
        res.json(storage.prefixesTypes);
        next();
    });
    router.get('/prefixes', keycloak.getProtect(keycloakRoles.API_VIEW), async (req, res, next) => {
        const { sort, order, from, to } = req.query;
        try {
            const response = await storage.getAllPrefixes({ sort, order, from, to });
            res.json(response);
            next();
        }
        catch (e) {
            next(handleStorageError(e));
        }
    });
    router.get('/prefixes/*', keycloak.getProtect(keycloakRoles.API_VIEW), async (req, res, next) => {
        const path = req.params[0];
        const { sort, order, from, to } = req.query;
        try {
            const response = await storage.getPrefixesByPath({ path, sort, order, from, to });
            res.json(response);
            next();
        }
        catch (e) {
            next(handleStorageError(e, 'prefix', path));
        }
    });
    router.get('/keys', keycloak.getProtect(keycloakRoles.API_VIEW), async (req, res, next) => {
        const { sort, order, from, to } = req.query;
        try {
            const response = await storage.getAllKeys({ sort, order, from, to });
            res.json(response);
            next();
        }
        catch (e) {
            next(handleStorageError(e));
        }
    });
    router.get('/keys/*', keycloak.getProtect(keycloakRoles.API_VIEW), async (req, res, next) => {
        const path = req.params[0];
        const { sort, order, from, to } = req.query;
        try {
            const response = await storage.getKeysByPath({ path, sort, order, from, to });
            res.json(response);
            next();
        }
        catch (e) {
            next(handleStorageError(e, 'key', path));
        }
    });
    router.get('/values/*', keycloak.getProtect(keycloakRoles.API_VIEW), async (req, res, next) => {
        const path = req.params[0];
        try {
            const metadata = await storage.getMetadata({ path });
            const result = storage.checkDataSize(metadata.size);
            if (result.error) {
                throw new Error(result.error);
            }
            const response = await storage.getByPath({ path });
            res.json(response);
            next();
        }
        catch (e) {
            next(handleStorageError(e, 'value', path));
        }
    });
    router.get('/stream/custom/*', keycloak.getProtect(keycloakRoles.API_VIEW), async (req, res, next) => {
        const path = req.params[0];
        try {
            const stream = await storage.getCustomStream({ path });
            await promisifyStream(res, stream);
        }
        catch (e) {
            handleStreamError(e, path, res, next);
        }
    });
    router.get('/stream/*', keycloak.getProtect(keycloakRoles.API_VIEW), async (req, res, next) => {
        const path = req.params[0];
        try {
            const stream = await storage.getStream({ path });
            await promisifyStream(res, stream);
        }
        catch (e) {
            handleStreamError(e, path, res, next);
        }
    });
    router.get('/download/custom/*', keycloak.getProtect(keycloakRoles.API_VIEW), async (req, res, next) => {
        const path = req.params[0];
        const { ext, namefile } = req.query;
        try {
            const stream = await storage.getCustomStream({ path });
            await downloadApi(res, stream, ext, namefile);
        }
        catch (e) {
            handleStreamError(e, path, res, next);
        }
    });
    router.get('/download/pipeline/result/:jobId/:namefile?', keycloak.getProtect(keycloakRoles.API_VIEW), async (req, res, next) => {
        const { jobId, namefile } = req.params;
        try {
            const stream = await storage.getPipelineResult({ jobId });
            await downloadApi(res, stream, 'zip', namefile);
        }
        catch (e) {
            handleStreamError(e, 'path', res, next);
        }
    });
    router.get('/download/*', keycloak.getProtect(keycloakRoles.API_VIEW), async (req, res, next) => {
        const path = req.params[0];
        const { ext } = req.query;
        try {
            const stream = await storage.getStream({ path });
            await downloadApi(res, stream, ext);
        }
        catch (e) {
            handleStreamError(e, path, res, next);
        }
    });
    return router;
};

module.exports = routes;
