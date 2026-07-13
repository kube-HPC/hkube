const RestServer = require('@hkube/rest-server');
const Internal = require('../../../lib/service/internal');
const methods = require('../middlewares/methods');

const routes = () => {
    const router = RestServer.router();
    router.all('/leader', methods(['GET']), async (req, res) => {
        const response = await Internal.getLeaderElection();
        res.json(response);
    });
    return router;
};

module.exports = routes;
