const RestServer = require('@hkube/rest-server');
const devenvs = require('../../../../lib/service/devenvs');

const routes = (options) => {
    const router = RestServer.router();
    router.get('/', (req, res) => {
        res.json({ message: `${options.version} ${options.file} api` });
    });
    router.get('/list', async (req, res) => {
        const response = await devenvs.list();
        res.json(response);
    });
    router.get('/:name?', async (req, res) => {
        const { name } = req.params;
        const response = await devenvs.get({ name });
        res.json(response);
    });
    router.delete('/:name?', async (req, res) => {
        const { name } = req.params;
        const response = await devenvs.delete({ name });
        res.json(response);
    });
    router.post('/', async (req, res) => {
        const response = await devenvs.create(req.body);
        res.json(response);
    });
    return router;
};

module.exports = routes;
