const RestServer = require('@hkube/rest-server');
const boards = require('../../../../lib/service/boards');

const routes = (options) => {
    const router = RestServer.router();
    router.get('/', (req, res) => {
        res.json({ message: `${options.version} ${options.file} api` });
    });
    router.get('/tensors', async (req, res) => {
        const response = await boards.getTensorboards();
        res.json(response);
    });
    router.get('/tensors/:id?', async (req, res) => {
        const { id } = req.params;
        const response = await boards.getTensorboard({ id });
        res.json(response);
    });
    router.delete('/tensors/:id?', async (req, res) => {
        const { id } = req.params;
        await boards.stopTensorboard({ id });
        res.json({ message: 'Board deleted' });
    });
    router.post('/tensors/', async (req, res) => {
        const { nodeName, pipelineName, jobId, taskId } = req.body;
        const id = await boards.startTensorboard({ taskId, jobId, nodeName, pipelineName });
        const message = 'Board started successfully';
        res.json({ id, message });
    });
    return router;
};

module.exports = routes;
