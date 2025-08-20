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
    router.post('/raw', keycloak.getProtect(keycloakRoles.API_EXECUTE), async (req, res) => {
        const userName = keycloak.getPreferredUsername(req);
        const { jobId, gateways } = await Execution.runRaw(req.body, userName);
        res.json({ jobId, gateways });
    });
    router.post('/stored', keycloak.getProtect(keycloakRoles.API_EXECUTE), async (req, res) => {
        const userName = keycloak.getPreferredUsername(req);
        const { jobId, gateways } = await Execution.runStored(req.body, userName);
        res.json({ jobId, gateways });
    });
    router.post('/caching', keycloak.getProtect(keycloakRoles.API_EXECUTE), async (req, res) => {
        const userName = keycloak.getPreferredUsername(req);
        const { jobId, gateways } = await Execution.runCaching(req.body, userName);
        res.json({ jobId, gateways });
    });
    router.post('/algorithm', keycloak.getProtect(keycloakRoles.API_EXECUTE), async (req, res) => {
        const userName = keycloak.getPreferredUsername(req);
        const { jobId, gateways } = await Execution.runAlgorithm(req.body, userName);
        res.json({ jobId, gateways });
    });
    router.post('/rerun', keycloak.getProtect(keycloakRoles.API_EXECUTE), async (req, res) => {
        const userName = keycloak.getPreferredUsername(req);
        const { jobId, gateways } = await Execution.rerun(req.body, userName);
        res.json({ jobId, gateways });
    });
    router.post('/getGraphByStreamingFlow', keycloak.getProtect(keycloakRoles.API_VIEW), async (req, res) => {
        const { nodes, edges } = await Execution._getGraphByStreamingFlow(req.body);
        res.json({ nodes, edges });
    });
    router.post('/stop', keycloak.getProtect(keycloakRoles.API_EXECUTE), async (req, res) => {
        const userName = keycloak.getPreferredUsername(req);
        const { jobId, pipelineName, startTime, reason, statusToStop } = req.body;
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
        let statusesToFilter;
        if (Array.isArray(statusToStop) && statusToStop.length > 0) {
            statusesToFilter = statusToStop;
        }
        else if (typeof statusToStop === 'string') {
            if (statusToStop.includes(',')) {
                statusesToFilter = statusToStop.split(',').map(s => s.trim());
            }
            else {
                statusesToFilter = [statusToStop];
            }
        }
        else {
            statusesToFilter = [pipelineStatuses.ACTIVE, pipelineStatuses.PENDING, pipelineStatuses.PAUSED];
        }
        const jobsToStop = searchResponse.hits.filter(j => statusesToFilter.includes(j.status.status));
        if (jobsToStop.length === 0) {
            const details = [];
            if (jobId) details.push(`jobId: ${jobId}`);
            if (pipelineName) details.push(`pipelineName: ${pipelineName}`);
            if (datesRange) details.push(`datesRange: ${datesRange.from} to ${datesRange.to}`);
            if (statusesToFilter && statusesToFilter.length > 0) details.push(`statuses: ${statusesToFilter.join(',')}`);
            errormsg = `No jobs found matching criteria${details.length ? ` (${details.join(', ')})` : ''}`;
            return res.status(404).json({
                error: {
                    code: 404,
                    message: errormsg
                }
            });
        }
        const stoppedJobIds = await Promise.all(
            jobsToStop.map(async job => {
                await Execution.stopJob({ job, reason, userName });
                return job.jobId;
            })
        );
        return res.status(200).json({ stoppedJobIds });
    });
    router.post('/pause', keycloak.getProtect(keycloakRoles.API_EXECUTE), async (req, res) => {
        const userName = keycloak.getPreferredUsername(req);
        const { jobId } = req.body;
        await Execution.pauseJob({ jobId, userName });
        res.json({ message: 'OK' });
    });
    router.post('/resume', keycloak.getProtect(keycloakRoles.API_EXECUTE), async (req, res) => {
        const userName = keycloak.getPreferredUsername(req);
        const { jobId } = req.body;
        await Execution.resumeJob({ jobId, userName });
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
    router.all('/auditTrail/:jobId?', methods(['GET']), keycloak.getProtect(keycloakRoles.API_VIEW), async (req, res) => {
        const { jobId } = req.params;
        const response = await Execution.getAuditTrail({ jobId });
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

    router.get('/search', keycloak.getProtect(keycloakRoles.API_VIEW), async (req, res) => {
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
