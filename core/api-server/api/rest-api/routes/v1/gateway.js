const express = require('express');
const Gateway = require('../../../../lib/service/gateway');
const logger = require('../../middlewares/logger');

const routes = () => {
    const router = express.Router();
    router.get('/', logger(), async (req, res, next) => {
        const { sort, order, limit } = req.query;
        const response = await Gateway.gatewaysList({ sort, order, limit });
        res.json(response);
        next();
    });
    router.get('/:name?', logger(), async (req, res, next) => {
        const { name } = req.params;
        const response = await Gateway.getGateway({ name });
        res.json(response);
        res.name = name;
        next();
    });
    router.post('/', logger(), async (req, res, next) => {
        const { name, jobId, nodeName, mem, description } = req.body;
        await Gateway.insertGateway({ name, description, jobId, nodeName, mem });
        res.json({ message: 'OK', name });
        next();
    });
    router.delete('/:name?', logger(), async (req, res, next) => {
        const { name } = req.params;
        const response = await Gateway.deleteGateway({ name });
        res.json(response);
        next();
    });

    return router;
};

module.exports = routes;
