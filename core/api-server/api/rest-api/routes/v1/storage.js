
const express = require('express');
const pathLib = require('path');
const logger = require('../../middlewares/logger');
const storage = require('../../../../lib/service/storage');
const { ResourceNotFoundError, InvalidDataError } = require('../../../../lib/errors');
const NOT_FOUND_CODES = ['ENOENT', 'EISDIR'];

const handleStorageError = (error, type, path) => {
    if (error.statusCode === 404 || NOT_FOUND_CODES.includes(error.code)) {
        return new ResourceNotFoundError(type, path, error.message);
    }
    return new InvalidDataError(error.message);
};

const handleStreamError = (err, path, res, next) => {
    res.removeHeader('Content-disposition');
    res.removeHeader('Content-type');
    next(handleStorageError(err, 'stream', path));
};

const routes = (options) => {
    const router = express.Router();
    router.get('/', (req, res, next) => {
        res.json({ message: `${options.version} ${options.file} api` });
        next();
    });
    router.get('/info', logger(), async (req, res, next) => {
        const response = await storage.getInfo();
        res.json(response);
        next();
    });
    router.get('/prefix/types', logger(), (req, res, next) => {
        res.json(storage.prefixesTypes);
        next();
    });
    router.get('/prefixes', logger(), async (req, res, next) => {
        const { sort, order, from, to } = req.query;
        try {
            const response = await storage.getAllPrefixes({ sort, order, from, to });
            res.json(response);
            next();
        }
        catch (e) {
            next(handleStorageError(e));
        }
    });
    router.get('/prefixes/*', logger(), async (req, res, next) => {
        const path = req.params[0];
        const { sort, order, from, to } = req.query;
        try {
            const response = await storage.getPrefixesByPath({ path, sort, order, from, to });
            res.json(response);
            next();
        }
        catch (e) {
            next(handleStorageError(e, 'prefix', path));
        }
    });
    router.get('/keys', logger(), async (req, res, next) => {
        const { sort, order, from, to } = req.query;
        try {
            const response = await storage.getAllKeys({ sort, order, from, to });
            res.json(response);
            next();
        }
        catch (e) {
            next(handleStorageError(e));
        }
    });
    router.get('/keys/*', logger(), async (req, res, next) => {
        const path = req.params[0];
        const { sort, order, from, to } = req.query;
        try {
            const response = await storage.getKeysByPath({ path, sort, order, from, to });
            res.json(response);
            next();
        }
        catch (e) {
            next(handleStorageError(e, 'key', path));
        }
    });
    router.get('/values/*', logger(), async (req, res, next) => {
        const path = req.params[0];
        try {
            const response = await storage.getByPath({ path });
            res.json(response);
            next();
        }
        catch (e) {
            next(handleStorageError(e, 'value', path));
        }
    });
    router.get('/stream/*', logger(), async (req, res, next) => {
        const path = req.params[0];
        const stream = await storage.getStream({ path });
        stream.on('error', err => handleStreamError(err, path, res, next));
        stream.pipe(res);
    });
    router.get('/download/*', logger(), async (req, res, next) => {
        const path = req.params[0];
        const stream = await storage.getStream({ path });
        const filename = pathLib.basename(path);
        stream.on('error', err => handleStreamError(err, path, res, next));
        res.setHeader('Content-disposition', `attachment; filename=${filename}`);
        res.setHeader('Content-type', 'application/octet-stream');
        stream.pipe(res);
    });

    return router;
};

module.exports = routes;
