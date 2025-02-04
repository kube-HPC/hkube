const RestServer = require('@hkube/rest-server');
const { pipelineStatuses } = require('@hkube/consts');
const { keycloakRoles } = require('@hkube/consts');
const Execution = require('../../../../lib/service/execution');
const methods = require('../../middlewares/methods');
const formatter = require('../../../../lib/utils/formatters');
const keycloak = require('../../../../lib/service/keycloak');

const createQueryObjectFromString = (str) => {
    return str?.replace(/\s/g, '').split(',').reduce((acc, cur) => {
        const [k, v] = cur.split(':');
        acc[k] = formatter.parseBool(v);
        return acc;
    }, {});
};

const routes = (options) => {
    const router = RestServer.router();
    router.get('/', keycloak.getProtect(keycloakRoles.API_VIEW), (req, res) => {
        res.json({ message: `${options.version} ${options.file} api` });
    });
    router.post('/raw', keycloak.getProtect(keycloakRoles.API_VIEW), async (req, res) => {
        const { jobId, gateways } = await Execution.runRaw(req.body);
        res.json({ jobId, gateways });
    });
    router.post('/stored', keycloak.getProtect(keycloakRoles.API_VIEW), async (req, res) => {
        const { jobId, gateways } = await Execution.runStored(req.body);
        res.json({ jobId, gateways });
    });
    router.post('/caching', keycloak.getProtect(keycloakRoles.API_VIEW), async (req, res) => {
        const { jobId, gateways } = await Execution.runCaching(req.body);
        res.json({ jobId, gateways });
    });
    router.post('/algorithm', keycloak.getProtect(keycloakRoles.API_VIEW), async (req, res) => {
        const { jobId, gateways } = await Execution.runAlgorithm(req.body);
        res.json({ jobId, gateways });
    });
    router.post('/rerun', keycloak.getProtect(keycloakRoles.API_VIEW), async (req, res) => {
        const { jobId, gateways } = await Execution.rerun(req.body);
        res.json({ jobId, gateways });
    });
    router.post('/getGraphByStreamingFlow', keycloak.getProtect(keycloakRoles.API_VIEW), async (req, res) => {
        const { nodes, edges } = await Execution.getGraphByStreamingFlow(req.body);
        res.json({ nodes, edges });
    });
    router.post('/stop', keycloak.getProtect(keycloakRoles.API_VIEW), async (req, res) => {
        const { jobId, pipelineName, startTime, reason } = req.body;
        let datesRange;
        let search;
        let errormsg;
        if (startTime && Object.keys(startTime).length > 0) {
            datesRange = { from: startTime.from, to: startTime.to };
            search = { query: { jobId, pipelineName, datesRange } };
        }
        else {
            search = { query: { jobId, pipelineName } };
        }
        if (jobId) {
            search.query.pipelineName = jobId;
        }
        const searchResponse = await Execution.search({ ...search });
        const jobsToStop = searchResponse.hits.filter(j => j.status.status === pipelineStatuses.ACTIVE || j.status.status === pipelineStatuses.PENDING || j.status.status === pipelineStatuses.PAUSED);
        if (jobsToStop.length === 0) {
            if (jobId) {
                errormsg = `jobId ${jobId} Not Found`;
            }
            else if (pipelineName && !datesRange) {
                errormsg = `No running jobs of ${pipelineName} to stop`;
            }
            else if (pipelineName) {
                errormsg = `No running jobs of ${pipelineName} which started between ${datesRange.from} to ${datesRange.to} to stop`;
            }
            else if (datesRange) {
                errormsg = `No Jobs Found between ${datesRange.from} to ${datesRange.to}`;
            }
            return res.status(404).json({
                error: {
                    code: 404,
                    message: errormsg
                }
            });
        }
        await Promise.all(jobsToStop.map(async job => {
            await Execution.stopJob({ job, reason });
        }));
        return res.json({ message: 'OK' });
    });
    router.post('/pause', keycloak.getProtect(keycloakRoles.API_VIEW), async (req, res) => {
        const { jobId } = req.body;
        await Execution.pauseJob({ jobId });
        res.json({ message: 'OK' });
    });
    router.post('/resume', keycloak.getProtect(keycloakRoles.API_VIEW), async (req, res) => {
        const { jobId } = req.body;
        await Execution.resumeJob({ jobId });
        res.json({ message: 'OK' });
    });
    router.all('/pipelines/:jobId?', methods(['GET']), keycloak.getProtect(keycloakRoles.API_VIEW), async (req, res) => {
        const { jobId } = req.params;
        const response = await Execution.getPipeline({ jobId });
        res.json(response);
    });
    router.all('/pipeline/list', methods(['GET']), keycloak.getProtect(keycloakRoles.API_VIEW), async (req, res) => {
        const response = await Execution.getRunningPipelines();
        res.json(response);
    });
    router.all('/jobs', methods(['GET']), keycloak.getProtect(keycloakRoles.API_VIEW), async (req, res,) => {
        const { status, raw } = req.query;
        const response = await Execution.getActivePipelines({ status, raw });
        res.json(response);
    });
    router.all('/status/:jobId?', methods(['GET']), keycloak.getProtect(keycloakRoles.API_VIEW), async (req, res) => {
        const { jobId } = req.params;
        const response = await Execution.getJobStatus({ jobId });
        res.json(response);
    });
    router.all('/results/:jobId?', methods(['GET']), keycloak.getProtect(keycloakRoles.API_VIEW), async (req, res) => {
        const { jobId } = req.params;
        const response = await Execution.getJobResult({ jobId });
        res.json(response);
        res.jobId = jobId;
    });
    router.all('/tree/:jobId?', methods(['GET']), keycloak.getProtect(keycloakRoles.API_VIEW), async (req, res) => {
        const { jobId } = req.params;
        const response = await Execution.getTree({ jobId });
        res.json(response);
    });
    router.get('/flowInput/:jobId?', keycloak.getProtect(keycloakRoles.API_VIEW), async (req, res) => {
        const data = await Execution.getFlowInputByJobId(req.params.jobId);
        if (data) {
            if (req.query.download) {
                res.setHeader('Content-Disposition', 'attachment;filename="flowInput.json"');
            }
            res.json(data);
        }
        else {
            res.status(404).end();
        }
    });

    router.get('/search', async (req, res) => {
        const { experimentName, pipelineName, pipelineType, algorithmName, pipelineStatus, from, to, cursor, page, sort, limit, fields, exists } = req.query;
        const search = {
            query: {
                experimentName,
                pipelineName,
                pipelineType,
                algorithmName,
                pipelineStatus,
                datesRange: { from, to }
            },
            cursor,
            sort,
            pageNum: formatter.parseInt(page),
            limit: formatter.parseInt(limit),
            fields: createQueryObjectFromString(fields),
            exists: createQueryObjectFromString(exists)
        };
        const response = await Execution.search(search);
        res.json(response);
    });
    router.post('/search', keycloak.getProtect(keycloakRoles.API_VIEW), async (req, res) => {
        const response = await Execution.search(req.body);
        res.json(response);
    });
    return router;
};

module.exports = routes;
