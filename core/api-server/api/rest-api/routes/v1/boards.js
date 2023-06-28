const RestServer = require('@hkube/rest-server');
const boards = require('../../../../lib/service/boards');

const routes = (options) => {
    const router = RestServer.router();
    router.get('/', (req, res) => {
        res.json({ message: `${options.version} ${options.file} api` });
    });
    router.get('/tensors', async (req, res) => {
        // const response = await boards.getTensorboards();
        res.json({ stam: 'kloomm' });
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

    router.get('/optunas', async (req, res) => {
        const response = await boards.getOptunaboards();
        res.json(response);
    });
    router.get('/optunas/:id?', async (req, res) => {
        const { id } = req.params;
        const response = await boards.getOptunaboard({ id });
        res.json(response);
    });
    router.delete('/optunas/:id?', async (req, res) => {
        const { id } = req.params;
        await boards.stopOptunaboard({ id });
        res.json({ message: 'Board deleted' });
    });
    router.post('/optunas/', async (req, res) => {
        const { jobId } = req.body;
        const boardUrl = await boards.startOptunaboard({ jobId });
        const message = 'Board started successfully';
        res.json({ id: jobId, message, boardUrl });
    });

    return router;
};

module.exports = routes;
