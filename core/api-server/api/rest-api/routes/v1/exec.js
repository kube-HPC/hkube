const express = require('express');
const Execution = require('../../../../lib/service/execution');
const methods = require('../../middlewares/methods');
const logger = require('../../middlewares/logger');

const routes = (options) => {
    const router = express.Router();
    router.get('/', (req, res, next) => {
        res.json({ message: `${options.version} ${options.file} api` });
        next();
    });
    router.all('/pipeline/:jobId?', methods(['GET']), logger(), (req, res, next) => {
        const { jobId } = req.params;
        Execution.getPipeline({ jobId }).then((response) => {
            res.json(response);
            next();
        }).catch((error) => {
            return next(error);
        });
    });
    router.all('/raw', methods(['POST']), logger(), (req, res, next) => {
        Execution.runRaw(req.body).then((jobId) => {
            res.json({ jobId });
            res.jobId = jobId;
            next();
        }).catch((error) => {
            return next(error);
        });
    });
    router.all('/stored', methods(['POST']), logger(), (req, res, next) => {
        Execution.runStored(req.body).then((jobId) => {
            res.json({ jobId });
            res.jobId = jobId;
            next();
        }).catch((error) => {
            return next(error);
        });
    });
    router.all('/status/:jobId?', methods(['GET']), logger(), (req, res, next) => {
        const { jobId } = req.params;
        Execution.getJobStatus({ jobId }).then((response) => {
            res.json(response);
            res.jobId = jobId;
            next();
        }).catch((error) => {
            return next(error);
        });
    });
    router.all('/results/:jobId?', methods(['GET']), logger(), (req, res, next) => {
        const { jobId } = req.params;
        Execution.getJobResult({ jobId }).then((response) => {
            res.json(response);
            res.jobId = jobId;
            next();
        }).catch((error) => {
            return next(error);
        });
    });
    router.all('/pipelines/results/raw/:name?', methods(['GET']), logger(), (req, res, next) => {
        const { name } = req.params;
        const { sort, order, limit } = req.query;
        Execution.getPipelinesResultRaw({ name, sort, order, limit }).then((response) => {
            res.json(response);
            res.name = name;
            next();
        }).catch((error) => {
            return next(error);
        });
    });
    router.all('/pipelines/results/stored/:name?', methods(['GET']), logger(), (req, res, next) => {
        const { name } = req.params;
        const { sort, order, limit } = req.query;
        Execution.getPipelinesResultStored({ name, sort, order, limit }).then((response) => {
            res.json(response);
            res.name = name;
            next();
        }).catch((error) => {
            return next(error);
        });
    });
    router.all('/pipelines/status/raw/:name?', methods(['GET']), logger(), (req, res, next) => {
        const { name } = req.params;
        const { sort, order, limit } = req.query;
        Execution.getPipelinesStatusRaw({ name, sort, order, limit }).then((response) => {
            res.json(response);
            res.name = name;
            next();
        }).catch((error) => {
            return next(error);
        });
    });
    router.all('/pipelines/status/stored/:name?', methods(['GET']), logger(), (req, res, next) => {
        const { name } = req.params;
        const { sort, order, limit } = req.query;
        Execution.getPipelinesStatusStored({ name, sort, order, limit }).then((response) => {
            res.json(response);
            res.name = name;
            next();
        }).catch((error) => {
            return next(error);
        });
    });
    router.all('/cron/results/:name?', methods(['GET']), logger(), (req, res, next) => {
        const { name } = req.params;
        const { sort, order, limit } = req.query;
        Execution.getCronResult({ name, sort, order, limit }).then((response) => {
            res.json(response);
            res.name = name;
            next();
        }).catch((error) => {
            return next(error);
        });
    });
    router.all('/cron/status/:name?', methods(['GET']), logger(), (req, res, next) => {
        const { name } = req.params;
        const { sort, order, limit } = req.query;
        Execution.getCronStatus({ name, sort, order, limit }).then((response) => {
            res.json(response);
            res.name = name;
            next();
        }).catch((error) => {
            return next(error);
        });
    });
    router.all('/stop', methods(['POST']), logger(), (req, res, next) => {
        const { jobId, reason } = req.body;
        Execution.stopJob({ jobId, reason }).then(() => {
            res.json({ message: 'OK' });
            res.jobId = jobId;
            next();
        }).catch((error) => {
            return next(error);
        });
    });
    router.all('/tree/:jobId?', methods(['GET']), logger(), (req, res, next) => {
        const { jobId } = req.params;
        Execution.getTree({ jobId }).then((response) => {
            res.json(response);
            res.jobId = jobId;
            next();
        }).catch((error) => {
            return next(error);
        });
    });
    router.all('/pipelines/list', methods(['GET']), logger(), (req, res, next) => {
        Execution.getRunningPipelines().then((response) => {
            res.json(response);
            next();
        }).catch((error) => {
            return next(error);
        });
    });
    return router;
};

module.exports = routes;
