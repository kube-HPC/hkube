const RestServer = require('@hkube/rest-server');
const { keycloakRoles } = require('@hkube/consts');
const Gateway = require('../../../../lib/service/gateway');
const keycloak = require('../../../../lib/service/keycloak');

const routes = () => {
    const router = RestServer.router();
    router.get('/', keycloak.getProtect(keycloakRoles.API_VIEW), async (req, res) => {
        const { sort, order, limit } = req.query;
        const response = await Gateway.getGateways({ sort, order, limit });
        res.json(response);
    });
    router.get('/:name?', keycloak.getProtect(keycloakRoles.API_VIEW), async (req, res) => {
        const { name } = req.params;
        const response = await Gateway.getGateway({ name });
        res.json(response);
    });
    return router;
};

module.exports = routes;
