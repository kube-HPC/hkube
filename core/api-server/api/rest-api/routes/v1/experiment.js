const RestServer = require('@hkube/rest-server');
const { keycloakRoles } = require('@hkube/consts');
const Experiment = require('../../../../lib/service/experiment');
const keycloak = require('../../../../lib/service/keycloak');

const routes = () => {
    const router = RestServer.router();
    router.get('/', keycloak.getProtect(keycloakRoles.API_VIEW), async (req, res) => {
        const { sort, order, limit } = req.query;
        const response = await Experiment.experimentsList({ sort, order, limit });
        res.json(response);
    });
    router.get('/:name?', keycloak.getProtect(keycloakRoles.API_VIEW), async (req, res) => {
        const { name } = req.params;
        const response = await Experiment.getExperiment({ name });
        res.json(response);
    });
    router.post('/', keycloak.getProtect(keycloakRoles.API_EDIT), async (req, res) => {
        const { name, description } = req.body;
        await Experiment.insertExperiment({ name, description });
        res.json({ message: 'OK', name });
    });
    router.delete('/:name?', keycloak.getProtect(keycloakRoles.API_DELETE), async (req, res) => {
        const { name } = req.params;
        const response = await Experiment.deleteExperiment({ name });
        res.json(response);
    });
    return router;
};

module.exports = routes;
