const RestServer = require('@hkube/rest-server');

const routes = (options) => {
    const router = RestServer.router();
    router.get('/', (req, res) => {
        res.json({ message: `${options.version} ${options.file} api` });
    });
    router.get('/list', async (req, res) => {
        const response = { get: 1 };
        res.json(response);
    });
    router.get('/:name?', async (req, res) => {
        const { name } = req.params;
        const response = { get: 1, name };
        res.json(response);
    });
    router.delete('/:name?', async (req, res) => {
        const { name } = req.params;
        const response = { delete: 1, name };
        res.json(response);
    });
    router.post('/', async (req, res) => {
        const { name } = req.body;
        const response = { name, post: 1 };
        res.json(response);
    });
    return router;
};

module.exports = routes;
