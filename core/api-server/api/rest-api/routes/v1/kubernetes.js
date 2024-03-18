const RestServer = require('@hkube/rest-server');
const HttpStatus = require('http-status-codes');
const kubernetes = require('../../../task-logs/kubernetes');

const routes = () => {
    const router = RestServer.router();
    router.delete('/algorithms/pods/:algName', async (req, res) => {
        const { algName } = req.params;
        let message = 'Deleting pod(s)): '; let pods; let podName;
        let { selector } = req.query;
        if (!selector) {
            selector = `algorithm-name=${algName}`;
        } // default selector - the common label for all algorithms
        try {
            pods = await kubernetes._getPods(selector);
            if (pods.body.items.length === 0) {
                res.json(`No pods found with selector ${selector}`);
                return;
            }
            pods.body.items.forEach(pod => {
                podName = pod.metadata.name;
                kubernetes._deletePods(podName);
                message += `${podName} ,`;
            });
        }
        catch (error) {
            res.status(HttpStatus.INTERNAL_SERVER_ERROR).json(error.message);
        }
        res.status(HttpStatus.OK).json({ message });
    });
    // end algorithms
    return router;
};

module.exports = routes;
