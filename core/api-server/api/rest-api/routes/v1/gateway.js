const express = require('express');
const Gateway = require('../../../../lib/service/gateway');
const logger = require('../../middlewares/logger');

const routes = () => {
    const router = express.Router();
    router.get('/', logger(), async (req, res) => {
        const { sort, order, limit } = req.query;
        const response = await Gateway.getGateways({ sort, order, limit });
        res.json(response);
    });
    router.get('/:name?', logger(), async (req, res) => {
        const { name } = req.params;
        const response = await Gateway.getGateway({ name });
        res.json(response);
    });
    return router;
};

module.exports = routes;
