const RestServer = require('@hkube/rest-server');
const { keycloakRoles } = require('@hkube/consts');
const HttpStatus = require('http-status-codes');
const kubernetes = require('../../../task-logs/kubernetes');
const keycloak = require('../../../../lib/service/keycloak');

const routes = () => {
    const router = RestServer.router();
    router.delete('/algorithms/pods/:algName', keycloak.getProtect(keycloakRoles.API_DELETE), async (req, res) => {
        const { algName } = req.params;
        const message = []; let pods; let podName;
        let { selector } = req.query;
        if (!selector) {
            selector = `algorithm-name=${algName}`;
        } // default selector - the common label for all algorithms
        try {
            pods = await kubernetes._getPods(selector);
            if (pods.body.items.length === 0) {
                res.status(HttpStatus.StatusCodes.NOT_FOUND).json(`No pods found with selector ${selector}`);
                return;
            }
            pods.body.items.forEach(pod => {
                podName = pod.metadata.name;
                kubernetes._deletePods(podName);
                message.push(podName);
            });
        }
        catch (error) {
            res.status(HttpStatus.StatusCodes.INTERNAL_SERVER_ERROR).json(error.message);
        }
        res.status(HttpStatus.StatusCodes.OK).json({ message });
    });
    router.delete('/algorithms/jobs/:algName', keycloak.getProtect(keycloakRoles.API_DELETE), async (req, res) => {
        const { algName } = req.params;
        const message = []; let jobs; let jobName;
        let { selector } = req.query;
        if (!selector) {
            selector = `algorithm-name=${algName}`;
        } // default selector - the common label for all algorithms
        try {
            jobs = await kubernetes._getJobs(selector);
            if (jobs.body.items.length === 0) {
                res.status(HttpStatus.StatusCodes.NOT_FOUND).json(`No jobs found with selector ${selector}`);
                return;
            }
            jobs.body.items.forEach(pod => {
                jobName = pod.metadata.name;
                kubernetes._deleteJobs(jobName);
                message.push(jobName);
            });
        }
        catch (error) {
            res.status(HttpStatus.StatusCodes.INTERNAL_SERVER_ERROR).json(error.message);
        }
        res.status(HttpStatus.StatusCodes.OK).json({ message });
    });
    // end algorithms
    return router;
};

module.exports = routes;
