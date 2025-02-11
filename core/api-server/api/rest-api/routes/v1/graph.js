const RestServer = require('@hkube/rest-server');
const { keycloakRoles } = require('@hkube/consts');
const graph = require('../../../../lib/service/graph');
const methods = require('../../middlewares/methods');
const keycloak = require('../../../../lib/service/keycloak');

const routes = () => {
    const router = RestServer.router();
    router.all('/raw/:jobId?', methods(['GET']), keycloak.getProtect(keycloakRoles.API_VIEW), async (req, res) => {
        const { jobId } = req.params;
        const response = await graph.getGraphRaw({ jobId });
        res.setHeader('Content-Type', 'application/json');
        res.send(response);
    });
    router.all('/parsed/:jobId?', methods(['GET']), keycloak.getProtect(keycloakRoles.API_VIEW), async (req, res) => {
        const { jobId } = req.params;
        const { node, sort, order, from, to } = req.query;
        const response = await graph.getGraphParsed({ jobId, node, sort, order, from, to });
        res.json(response);
    });
    return router;
};

module.exports = routes;
