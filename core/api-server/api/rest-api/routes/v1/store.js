const RestServer = require('@hkube/rest-server');
const { keycloakRoles } = require('@hkube/consts');
const fse = require('fs-extra');
const multer = require('multer');
const HttpStatus = require('http-status-codes');
const pipelineStore = require('../../../../lib/service/pipelines');
const algorithmStore = require('../../../../lib/service/algorithms');
const upload = multer({ dest: 'uploads/zipped/' });
const keycloak = require('../../../../lib/service/keycloak');

const routes = (option) => {
    const router = RestServer.router();
    router.get('/', (req, res) => {
        res.json({ message: `${option.version} ${option.file} api` });
    });

    // pipelines
    router.get('/pipelines', keycloak.getProtect(keycloakRoles.API_VIEW), async (req, res) => {
        const { sort } = req.query;
        const response = await pipelineStore.getPipelines({ sort });
        res.json(response);
    });
    router.get('/pipelines/:name', keycloak.getProtect(keycloakRoles.API_VIEW), async (req, res) => {
        const { name } = req.params;
        const response = await pipelineStore.getPipeline({ name });
        res.json(response);
    });

    router.get('/pipelines/graph/:name', keycloak.getProtect(keycloakRoles.API_VIEW), async (req, res) => {
        const { name } = req.params;
        req.body.name = name;
        const response = await pipelineStore.getGraphByKindOrName(req.body);
        res.json(response);
    });

    router.post('/pipelines/graph', keycloak.getProtect(keycloakRoles.API_VIEW), async (req, res) => {
        const response = await pipelineStore.getGraphByKindOrName(req.body);
        res.json(response);
    });

    /*  router.post('/pipelines/graph', async (req, res) => {
        const response = await pipelineStore.getPipelineGraph({ name: null, pipeline: req.body.pipeline });
        res.json(response);
    }); */

    router.post('/pipelines', keycloak.getProtect(keycloakRoles.API_EDIT), async (req, res) => {
        const allowOverwrite = req.query.overwrite;
        const userName = keycloak.getPreferredUsername(req);
        if (Array.isArray(req.body)) {
            const returnPipelineList = await Promise.all(
                req.body.map(async (pipelineData) => {
                    // eslint-disable-next-line no-return-await
                    return await pipelineStore.insertPipeline(pipelineData, false, allowOverwrite, userName);
                })
            );
            res.status(HttpStatus.StatusCodes.CREATED).json(returnPipelineList);
        }
        else {
            const response = await pipelineStore.insertPipeline(req.body, true, false, userName);
            res.status(HttpStatus.StatusCodes.CREATED).json(response);
        }
    });
    router.put('/pipelines', keycloak.getProtect(keycloakRoles.API_EDIT), async (req, res) => {
        const userName = keycloak.getPreferredUsername(req);
        const response = await pipelineStore.updatePipeline(req.body, userName);
        res.json(response);
    });
    router.delete('/pipelines/:name', keycloak.getProtect(keycloakRoles.API_DELETE), async (req, res) => {
        const { name } = req.params;
        const keepOldVersions = req?.query?.keepOldVersions !== 'false';
        const message = await pipelineStore.deletePipeline({ name, keepOldVersions });
        res.json({ message });
    });
    // pipelines

    // algorithms
    const _processPayLoadAndOptions = async (givenPayload, givenOptions) => {
        const bodyPayload = (givenPayload) || '{}';
        const bodyOptions = (givenOptions) || '{}';
        const payload = JSON.parse(bodyPayload);
        const options = JSON.parse(bodyOptions);
        return { payload, options };
    };

    router.get('/algorithms', keycloak.getProtect(keycloakRoles.API_VIEW), async (req, res) => {
        const { name, sort, limit } = req.query;
        const response = await algorithmStore.getAlgorithms({ name, sort, limit });
        res.json(response);
    });
    router.get('/algorithmsFilter', keycloak.getProtect(keycloakRoles.API_VIEW), async (req, res) => {
        const { name, kind, algorithmImage, pending, cursor, page, sort, limit, fields } = req.query;
        const response = await algorithmStore.searchAlgorithm({ name, kind, algorithmImage, pending, cursor, page, sort, limit, fields });
        res.json(response);
    });
    router.get('/algorithms/:name', keycloak.getProtect(keycloakRoles.API_VIEW), async (req, res) => {
        const { name } = req.params;
        const response = await algorithmStore.getAlgorithm({ name });
        res.json(response);
    });
    router.post('/algorithms', keycloak.getProtect(keycloakRoles.API_EDIT), upload.single('file'), async (req, res) => {
        const { file, body } = req;
        const userName = keycloak.getPreferredUsername(req);
        try {
            if (body.payload !== undefined) { // New way
                if (Array.isArray(body.payload)) {
                    const returnAlgoList = await Promise.all(
                        body.payload.map(async (algorithmData) => {
                            const { payload, options } = await _processPayLoadAndOptions(algorithmData, body.options);
                            options.failOnError = false;
                            const response = await algorithmStore.insertAlgorithm({ payload, options, userName });
                            return response;
                        })
                    );
                    res.status(HttpStatus.StatusCodes.CREATED).json(returnAlgoList);
                }
                else {
                    // If req.body.payload is not an array, process it as a single algorithm
                    const { payload, options } = await _processPayLoadAndOptions(body.payload, body.options);
                    const response = await algorithmStore.insertAlgorithm({ payload, options, file, userName });
                    res.status(HttpStatus.StatusCodes.CREATED).json(response);
                }
            }
            else { // Old way
                const allowOverwrite = req.query.overwrite;
                if (Array.isArray(req.body)) {
                    const returnAlgoList = await Promise.all(
                        req.body.map(async (algorithmData) => {
                            const payload = algorithmData;
                            const options = { failOnError: false, allowOverwrite };
                            const response = await algorithmStore.insertAlgorithm({ payload, options, userName });
                            const { algorithm } = response;
                            return algorithm || response;
                        })
                    );
                    res.status(HttpStatus.StatusCodes.CREATED).json(returnAlgoList);
                }
                else {
                    // If req.body is not an array, process it as a single algorithm
                    const payload = req.body;
                    const options = { failOnError: true, allowOverwrite };
                    const response = await algorithmStore.insertAlgorithm({ payload, options, userName });
                    const { algorithm } = response;
                    res.status(HttpStatus.StatusCodes.CREATED).json(algorithm || response);
                }
            }
        }
        finally {
            if (file?.path) {
                await fse.remove(file.path);
            }
        }
    });
    router.put('/algorithms', keycloak.getProtect(keycloakRoles.API_EDIT), upload.single('file'), async (req, res) => {
        const { file, body } = req;
        const userName = keycloak.getPreferredUsername(req);
        try {
            if (body.payload !== undefined) { // New way
                const { payload, options } = await _processPayLoadAndOptions(body.payload, body.options);
                const response = await algorithmStore.updateAlgorithm({ payload, options, file, userName });
                res.json(response);
            }
            else { // Old way
                const forceUpdate = req?.query?.forceStopAndApplyVersion === 'true';
                const payload = req.body;
                const options = { forceUpdate };
                const response = await algorithmStore.updateAlgorithm({ payload, options, userName });
                const { algorithm } = response;
                res.json(algorithm || response);
            }
        }
        finally {
            if (file?.path) {
                await fse.remove(file.path);
            }
        }
    });
    router.delete('/algorithms/:name', keycloak.getProtect(keycloakRoles.API_DELETE), async (req, res) => {
        const { name } = req.params;
        const { force } = req.query;
        const keepOldVersions = req?.query?.keepOldVersions !== 'false';
        const message = await algorithmStore.deleteAlgorithm({ name, force, keepOldVersions });
        res.json({ message });
    });
    router.post('/algorithms/apply', keycloak.getProtect(keycloakRoles.API_EDIT), upload.single('file'), async (req, res) => {
        const { file, body } = req;
        const userName = keycloak.getPreferredUsername(req);
        try {
            const { payload, options } = await _processPayLoadAndOptions(body.payload, body.options);
            const response = await algorithmStore.applyAlgorithm({ options, payload, file, userName });
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
