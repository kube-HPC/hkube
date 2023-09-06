const RestServer = require('@hkube/rest-server');
const Execution = require('../../../../lib/service/execution');
const methods = require('../../middlewares/methods');
const formatter = require('../../../../lib/utils/formatters');

const createQueryObjectFromString = (str) => {
    return str?.replace(/\s/g, '').split(',').reduce((acc, cur) => {
        const [k, v] = cur.split(':');
        acc[k] = formatter.parseBool(v);
        return acc;
    }, {});
};

const routes = (options) => {
    const router = RestServer.router();
    router.get('/', (req, res) => {
        res.json({ message: `${options.version} ${options.file} api` });
    });
    router.post('/raw', async (req, res) => {
        const { jobId, gateways } = await Execution.runRaw(req.body);
        res.json({ jobId, gateways });
    });
    router.post('/stored', async (req, res) => {
        const { jobId, gateways } = await Execution.runStored(req.body);
        res.json({ jobId, gateways });
    });
    router.post('/caching', async (req, res) => {
        const { jobId, gateways } = await Execution.runCaching(req.body);
        res.json({ jobId, gateways });
    });
    router.post('/algorithm', async (req, res) => {
        const { jobId, gateways } = await Execution.runAlgorithm(req.body);
        res.json({ jobId, gateways });
    });
    router.post('/rerun', async (req, res) => {
        const { jobId, gateways } = await Execution.rerun(req.body);
        res.json({ jobId, gateways });
    });
    router.post('/stop', async (req, res) => {
        const { jobId, pipelineName, startTime } = req.body;
        let datesRange;
        let search;
        let errormsg;
        if (startTime !== undefined && startTime !== {}) {
            datesRange = { from: startTime.from, to: startTime.to };
            search = { query: { jobId, pipelineName, datesRange } };
        }
        else {
            search = { query: { jobId, pipelineName } };
        }
        if (jobId) {
            search.query.pipelineName = jobId;
        }
        const searchResponse = await Execution.search({ ...search, limit: 100 });
        const jobsToStop = searchResponse.hits.filter(j => j.status.status === 'active' || j.status.status === 'pending');
        if (jobsToStop.length === 0) {
            if (jobId) {
                errormsg = `jobId ${jobId} Not Found`;
            }
            else if (pipelineName && !datesRange) {
                errormsg = `pipelineName ${pipelineName} jobs Not Found`;
            }
            else if (pipelineName) {
                errormsg = `pipelineName ${pipelineName} jobs Not Found between ${datesRange.from} to ${datesRange.to}`;
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
            await Execution.stopJob({ job });
        }));
        return res.json({ message: 'OK' });
    });
    router.post('/pause', async (req, res) => {
        const { jobId } = req.body;
        await Execution.pauseJob({ jobId });
        res.json({ message: 'OK' });
    });
    router.post('/resume', async (req, res) => {
        const { jobId } = req.body;
        await Execution.resumeJob({ jobId });
        res.json({ message: 'OK' });
    });
    router.all('/pipelines/:jobId?', methods(['GET']), async (req, res) => {
        const { jobId } = req.params;
        const response = await Execution.getPipeline({ jobId });
        res.json(response);
    });
    router.all('/pipeline/list', methods(['GET']), async (req, res) => {
        const response = await Execution.getRunningPipelines();
        res.json(response);
    });
    router.all('/jobs', methods(['GET']), async (req, res,) => {
        const { status, raw } = req.query;
        const response = await Execution.getActivePipelines({ status, raw });
        res.json(response);
    });
    router.all('/status/:jobId?', methods(['GET']), async (req, res) => {
        const { jobId } = req.params;
        const response = await Execution.getJobStatus({ jobId });
        res.json(response);
    });
    router.all('/results/:jobId?', methods(['GET']), async (req, res) => {
        const { jobId } = req.params;
        const response = await Execution.getJobResult({ jobId });
        res.json(response);
        res.jobId = jobId;
    });
    router.all('/tree/:jobId?', methods(['GET']), async (req, res) => {
        const { jobId } = req.params;
        const response = await Execution.getTree({ jobId });
        res.json(response);
    });
    router.get('/flowInput/:jobId?', async (req, res) => {
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
    router.post('/search', async (req, res) => {
        const response = await Execution.search(req.body);
        res.json(response);
    });
    return router;
};

module.exports = routes;
