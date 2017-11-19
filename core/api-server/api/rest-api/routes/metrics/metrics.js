/*
 * Created by nassi on 15/10/15.
 *
 * This module is a simple handler for /catalog route
 * The module exports the routes function.
 *
 */

const prom = require('lib/utils/prometheus');
const express = require('express');

const routes = function () {
    const router = express.Router();

    router.get('/', (req, res) => {
        res.send(prom.metrics())
    });

    return router;
};

module.exports = routes;

