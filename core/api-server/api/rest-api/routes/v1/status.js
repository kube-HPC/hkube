const RestServer = require('@hkube/rest-server');
const { keycloakRoles } = require('@hkube/consts');
const keycloak = require('../../../../lib/service/keycloak');

const routes = (options) => {
    const router = RestServer.router();
    router.get('/', keycloak.getProtect(keycloakRoles.API_VIEW), (req, res) => {
        res.json({ message: `${options.version} ${options.file} api` });
    });
    router.get('/version', keycloak.getProtect(keycloakRoles.API_VIEW), async (req, res) => {
        const version = {
            systemVersion: options.systemVersion,
            clusterName: options.clusterName,
            storage: options.defaultStorage,
        };
        res.json(version);
    });
    return router;
};

module.exports = routes;
