const RestServer = require('@hkube/rest-server');
const Execution = require('../../../../lib/service/execution');
const methods = require('../../middlewares/methods');
const logger = require('../../middlewares/logger');
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
    router.get('/', (req, res, next) => {
        res.json({ message: `${options.version} ${options.file} api` });
        next();
    });
    router.all('/raw', methods(['POST']), logger(), async (req, res, next) => {
        const { jobId, gateways } = await Execution.runRaw(req.body);
        res.json({ jobId, gateways });
        res.jobId = jobId;
        next();
    });
    router.all('/stored', methods(['POST']), logger(), async (req, res, next) => {
        const { jobId, gateways } = await Execution.runStored(req.body);
        res.json({ jobId, gateways });
        res.jobId = jobId;
        next();
    });
    router.all('/caching', methods(['POST']), logger(), async (req, res, next) => {
        const { jobId, gateways } = await Execution.runCaching(req.body);
        res.json({ jobId, gateways });
        res.jobId = jobId;
        next();
    });
    router.all('/algorithm', methods(['POST']), logger(), async (req, res, next) => {
        const { jobId, gateways } = await Execution.runAlgorithm(req.body);
        res.json({ jobId, gateways });
        res.jobId = jobId;
        next();
    });
    router.all('/stop', methods(['POST']), logger(), async (req, res, next) => {
        const { jobId, reason } = req.body;
        await Execution.stopJob({ jobId, reason });
        res.json({ message: 'OK' });
        res.jobId = jobId;
        next();
    });
    router.all('/pause', methods(['POST']), logger(), async (req, res, next) => {
        const { jobId } = req.body;
        await Execution.pauseJob({ jobId });
        res.json({ message: 'OK' });
        res.jobId = jobId;
        next();
    });
    router.all('/resume', methods(['POST']), logger(), async (req, res, next) => {
        const { jobId } = req.body;
        await Execution.resumeJob({ jobId });
        res.json({ message: 'OK' });
        res.jobId = jobId;
        next();
    });
    router.all('/pipelines/:jobId?', methods(['GET']), logger(), async (req, res, next) => {
        const { jobId } = req.params;
        const response = await Execution.getPipeline({ jobId });
        res.json(response);
        next();
    });
    router.all('/pipeline/list', methods(['GET']), logger(), async (req, res, next) => {
        const response = await Execution.getRunningPipelines();
        res.json(response);
        next();
    });
    router.all('/status/:jobId?', methods(['GET']), logger(), async (req, res, next) => {
        const { jobId } = req.params;
        const response = await Execution.getJobStatus({ jobId });
        res.json(response);
        res.jobId = jobId;
        next();
    });
    router.all('/results/:jobId?', methods(['GET']), logger(), async (req, res, next) => {
        const { jobId } = req.params;
        const response = await Execution.getJobResult({ jobId });
        res.json(response);
        res.jobId = jobId;
        next();
    });
    router.all('/tree/:jobId?', methods(['GET']), logger(), async (req, res, next) => {
        const { jobId } = req.params;
        const response = await Execution.getTree({ jobId });
        res.json(response);
        res.jobId = jobId;
        next();
    });
    router.get('/search', logger(), async (req, res, next) => {
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
        next();
    });
    router.post('/search', logger(), async (req, res, next) => {
        const response = await Execution.search(req.body);
        res.json(response);
        next();
    });
    return router;
};

module.exports = routes;
