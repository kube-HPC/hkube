const express = require('express');
const graph = require('../../../../lib/service/graph');

const routes = () => {
    const router = express.Router();
    router.post('/stream/:jobId?', async (req, res) => {
        const { jobId } = req.params;
        const response = await graph.getGraphRaw({ jobId });
        res.json(response);
    });
    return router;
};

module.exports = routes;
