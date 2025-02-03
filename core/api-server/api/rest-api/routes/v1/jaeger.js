const RestServer = require('@hkube/rest-server');
const { keycloakRoles } = require('@hkube/consts');
const { pipeTrace } = require('../../../../lib/service/jaeger-api');
const keycloak = require('../../../../lib/service/keycloak');

const routes = () => {
    const router = RestServer.router();
    router.get('/', keycloak.getProtect(keycloakRoles.API_VIEW), async (req, res) => {
        await pipeTrace(req.query.jobId, res);
    });

    return router;
};

module.exports = routes;
