const express = require('express');
const graph = require('../../../../lib/service/graph');
const methods = require('../../middlewares/methods');
const logger = require('../../middlewares/logger');

const routes = () => {
    const router = express.Router();
    router.all('/raw/:jobId?', methods(['GET']), logger(), async (req, res, next) => {
        const { jobId } = req.params;
        const response = await graph.getGraphRaw({ jobId });
        res.setHeader('Content-Type', 'application/json');
        res.send(response);
        next();
    });
    router.all('/parsed/:jobId?', methods(['GET']), logger(), async (req, res, next) => {
        const { jobId } = req.params;
        const { node, sort, order, from, to } = req.query;
        const response = await graph.getGraphParsed({ jobId, node, sort, order, from, to });
        res.json(response);
        next();
    });
    return router;
};

module.exports = routes;
