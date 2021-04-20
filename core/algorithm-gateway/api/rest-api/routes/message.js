const express = require('express');
const algorithm = require('../../../algorithm_unique_folder');

const routes = () => {
    const router = express.Router();
    router.post('/', async (req, res) => {
        const { flowName } = req.query;
        const message = req.body;
        await algorithm.streamMessage(message, flowName);
        res.json({ message: 'OK' });
    });
    return router;
};

module.exports = routes;
