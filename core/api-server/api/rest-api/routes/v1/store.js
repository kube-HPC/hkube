const RestServer = require('@hkube/rest-server');
const fse = require('fs-extra');
const multer = require('multer');
const HttpStatus = require('http-status-codes');
const pipelineStore = require('../../../../lib/service/pipelines');
const algorithmStore = require('../../../../lib/service/algorithms');
const upload = multer({ dest: 'uploads/zipped/' });

const routes = (option) => {
    const router = RestServer.router();
    router.get('/', (req, res) => {
        res.json({ message: `${option.version} ${option.file} api` });
    });

    // pipelines
    router.get('/pipelines', async (req, res) => {
        const { sort } = req.query;
        const response = await pipelineStore.getPipelines({ sort });
        res.json(response);
    });
    router.get('/pipelines/:name', async (req, res) => {
        const { name } = req.params;
        const response = await pipelineStore.getPipeline({ name });
        res.json(response);
    });

    router.get('/pipelines/graph/:name', async (req, res) => {
        const { name } = req.params;
        const response = await pipelineStore.getPipelineGraph({ name });
        res.json(response);
    });

    router.post('/pipelines/graph', async (req, res) => {
        const response = await pipelineStore.getPipelineGraph({ name: null, pipeline: req.body.pipeline });
        res.json(response);
    });

    router.post('/pipelines', async (req, res) => {
        const response = await pipelineStore.insertPipeline(req.body);
        res.status(HttpStatus.CREATED).json(response);
    });
    router.put('/pipelines', async (req, res) => {
        const response = await pipelineStore.updatePipeline(req.body);
        res.json(response);
    });
    router.delete('/pipelines/:name', async (req, res) => {
        const { name } = req.params;
        const message = await pipelineStore.deletePipeline({ name });
        res.json({ message });
    });
    // pipelines

    // algorithms
    router.get('/algorithms', async (req, res) => {
        const { name, sort, limit } = req.query;
        const response = await algorithmStore.getAlgorithms({ name, sort, limit });
        res.json(response);
    });
    router.get('/algorithmsFilter', async (req, res) => {
        const { name, kind, algorithmImage, pending, cursor, page, sort, limit, fields } = req.query;
        const response = await algorithmStore.searchAlgorithm({ name, kind, algorithmImage, pending, cursor, page, sort, limit, fields });
        res.json(response);
    });
    router.get('/algorithms/:name', async (req, res) => {
        const { name } = req.params;
        const response = await algorithmStore.getAlgorithm({ name });
        res.json(response);
    });
    router.post('/algorithms', async (req, res) => {
        const response = await algorithmStore.insertAlgorithm(req.body);
        res.status(HttpStatus.CREATED).json(response);
    });
    router.put('/algorithms', async (req, res) => {
        const response = await algorithmStore.updateAlgorithm(req.body);
        res.json(response);
    });
    router.delete('/algorithms/:name', async (req, res) => {
        const { name } = req.params;
        const { force } = req.query;
        const keepOldVersions = req?.query?.keepOldVersions !== 'false';
        const message = await algorithmStore.deleteAlgorithm({ name, force, keepOldVersions });
        res.json({ message });
    });
    router.post('/algorithms/apply', upload.single('file'), async (req, res) => {
        const { file } = req;
        try {
            const bodyPayload = (req.body.payload) || '{}';
            const bodyOptions = (req.body.options) || '{}';
            const payload = JSON.parse(bodyPayload);
            const options = JSON.parse(bodyOptions);
            const response = await algorithmStore.applyAlgorithm({ options, payload, file });
            res.json(response);
        }
        finally {
            if (file?.path) {
                await fse.remove(file.path);
            }
        }
    });
    // algorithms

    return router;
};

module.exports = routes;
