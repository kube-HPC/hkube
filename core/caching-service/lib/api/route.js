const express = require('express');
const runner = require('../runner');

const routes = (options) => {
    const router = express.Router();
    router.get('/', (req, res, next) => {
        res.json({ message: `${options.version} ${options.file} api` });
        next();
    });
    router.get('/cache', async (req, res, next) => {
        try {
            const { jobId, nodeName } = req.query;
            const response = await runner.parse(jobId, nodeName);
            res.json(response);
            return next();
        }
        catch (error) {
            return next(error);
        }
    });
    return router;
};

module.exports = routes;
