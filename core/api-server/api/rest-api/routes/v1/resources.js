const RestServer = require('@hkube/rest-server');
const { keycloakRoles } = require('@hkube/consts');
const keycloak = require('../../../../lib/service/keycloak');
const DatabaseQuerier = require('../../../graphql/queries/database-querier');

const taskExecResourceName = 'task-executor';

/**
 * Fetches and returns the algorithms data from the database.
 * @param {'unScheduledAlgorithms'|'ignoredUnScheduledAlgorithms'} type - Type of algorithms ('unScheduledAlgorithms' or 'ignoredUnScheduledAlgorithms')
 */
const fetchAlgorithms = async (type) => {
    const resources = await DatabaseQuerier._getDiscoveryType(taskExecResourceName);
    return resources?.[0]?.[type] || {};
};

/**
 * Creates a route handler for listing algorithms.
 * @param {string} type - Type of algorithms ('unScheduledAlgorithms' or 'ignoredUnScheduledAlgorithms')
 */
const createListHandler = (type) => {
    return async (req, res) => {
        try {
            const algorithms = await fetchAlgorithms(type);
            res.json(algorithms);
        }
        catch (error) {
            res.status(500).send(`Failed fetching info from ${taskExecResourceName}: ${error.message}`);
        }
    };
};

/**
 * Creates a route handler for fetching a specific algorithm by name.
 * @param {string} type - Type of algorithms ('unScheduledAlgorithms' or 'ignoredUnScheduledAlgorithms')
 * @param {string} label - Label for error messages
 */
const createItemHandler = (type, label) => {
    return async (req, res) => {
        const { name } = req.params;
        try {
            const algorithms = await fetchAlgorithms(type);
            const algorithm = algorithms[name];
            if (!algorithm) {
                return res.status(404).send(`Algorithm ${name} not found in the ${label} list`);
            }
            // change type to kind in the response
            const { type: algoType, ...rest } = algorithm;
            return res.json({ ...rest, kind: algoType });
        }
        catch (error) {
            return res.status(500).send(`Failed fetching ${name} info from ${taskExecResourceName}: ${error.message}`);
        }
    };
};

const routes = () => {
    const router = RestServer.router();
    const protect = keycloak.getProtect(keycloakRoles.API_VIEW);

    // Unscheduled algorithms
    router.get('/unscheduledalgorithms', protect, createListHandler('unScheduledAlgorithms'));
    router.get('/unscheduledalgorithms/:name', protect, createItemHandler('unScheduledAlgorithms', 'unscheduled'));

    // Ignored unscheduled algorithms
    router.get('/ignoredunscheduledalgorithms', protect, createListHandler('ignoredUnScheduledAlgorithms'));
    router.get('/ignoredunscheduledalgorithms/:name', protect, createItemHandler('ignoredUnScheduledAlgorithms', 'ignored unscheduled'));

    return router;
};

module.exports = routes;
