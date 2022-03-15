const RestServer = require('@hkube/rest-server');
const managedQueue = require('../../lib/service/managed');
const preferredQueue = require('../../lib/service/preferred-jobs');

const routes = () => {
    const router = RestServer.router();
    router.get('/count/', (req, res) => {
        const managed = managedQueue.getCount();
        const preferred = preferredQueue.getCount();
        res.json({ managed, preferred });
    });
    return router;
};

module.exports = routes;
