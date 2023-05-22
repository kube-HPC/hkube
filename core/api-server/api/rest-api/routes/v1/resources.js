const RestServer = require('@hkube/rest-server');
const DatabaseQuerier = require('../../../graphql/queries/database-querier');

// const { pipeTrace } = require('../../../../lib/service/jaeger-api');
const taskExecResourceName = 'task-executor';
const routes = () => {
    const router = RestServer.router();
    router.get('/unscheduledalgorithms', async (req, res) => {
        let mergedResoures;
        try {
            const resources = await DatabaseQuerier._getDiscoveryType(taskExecResourceName);
            mergedResoures = { ...resources[0].unScheduledAlgorithms, ...resources[0].ignoredUnscheduledAlgorithms };
        }
        catch (error) {
            res.status(500).send(`Failed fetching info from ${taskExecResourceName}, ${error}`);
        }
        res.json(mergedResoures);
    });
    router.get('/unscheduledalgorithms/:algorithmName', async (req, res) => {
        let mergedResources;
        const { algorithmName } = req.params;
        try {
            const resources = await DatabaseQuerier._getDiscoveryType(taskExecResourceName);
            mergedResources = { ...resources[0].unScheduledAlgorithms, ...resources[0].ignoredUnscheduledAlgorithms };
            if (!mergedResources[algorithmName]) {
                res.status(404).send(`Algorithm ${algorithmName} not found in the unscheduled list`);
            }
            else {
                res.json(mergedResources[algorithmName]);
            }
        }
        catch (error) {
            res.status(500).send(`Failed fetching '${algorithmName}' info from ${taskExecResourceName}, ${error}`);
        }
        res.json(mergedResources);
    });
    return router;
};

module.exports = routes;
