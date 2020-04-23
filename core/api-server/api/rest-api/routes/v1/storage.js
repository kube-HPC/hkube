
const express = require('express');
const pathLib = require('path');
const prettyBytes = require('pretty-bytes');
const unitsConverter = require('@hkube/units-converter');
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

const checkDataSize = async (size, storageResultsThreshold) => {
    if (size >= storageResultsThreshold) {
        // currently we are not supporting huge decoding
        throw new Error(`data too large (${prettyBytes(size)}), use the stream api`);
    }
};

const streamApi = (res, stream, path, next) => {
    stream.on('error', err => handleStreamError(err, path, res, next));
    stream.pipe(res);
};

const downloadApi = (res, stream, path, next) => {
    res.setHeader('Content-disposition', 'attachment; filename=hkubeResult');
    res.setHeader('Content-type', 'application/octet-stream');
    streamApi(res, stream, path, next);
};

const downloadJson = async (res, options) => {
    const data = await storage.getByPath(options, { customEncode: true });
    res.set('Content-disposition', 'attachment; filename=hkubeResult');
    res.set('Content-Type', 'application/json');
    res.json(data);
};

const customStorage = async (res, path, streamFn, storageResultsThreshold, next) => {
    const metadata = await storage.getMetadata({ path });
    const totalLength = metadata.size;

    // read last 3 bytes for footer length and magic number
    const lastBytes = await storage.seek({ path, end: -3 });
    const magicNumber = lastBytes.slice(1, lastBytes.length).toString('hex');

    // check if hkube encoding is here
    if (magicNumber === '484b') {
        // check the footer length and get the footer
        const footerLength = lastBytes.slice(0, 1)[0];
        const footer = await storage.seek({ path, start: totalLength - footerLength, end: totalLength });
        const dataType = footer[2];

        // this data is encoded, so we should decode it
        if (dataType === 2) {
            checkDataSize(totalLength, storageResultsThreshold);
            await downloadJson(res, { path });
        }
        else {
            // this data is not encoded, we should stream it (without footer)
            const stream = await storage.getStream({ path, start: 0, end: totalLength - footerLength - 1 });
            streamFn(res, stream, path, next);
        }
    }
    else {
        const stream = await storage.getStream({ path });
        streamFn(res, stream, path, next);
    }
};

const routes = (options) => {
    const router = express.Router();
    const storageResultsThreshold = unitsConverter.getMemoryInBytes(options.storageResultsThreshold);

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
            const metadata = await storage.getMetadata({ path });
            checkDataSize(metadata.size, storageResultsThreshold);
            const response = await storage.getByPath({ path });
            res.json(response);
            next();
        }
        catch (e) {
            next(handleStorageError(e, 'value', path));
        }
    });
    router.get('/stream/custom/*', logger(), async (req, res, next) => {
        const path = req.params[0];
        try {
            await customStorage(res, path, streamApi, storageResultsThreshold, next);
        }
        catch (e) {
            next(handleStorageError(e, 'value', path));
        }
    });
    router.get('/stream/*', logger(), async (req, res, next) => {
        const path = req.params[0];
        const stream = await storage.getStream({ path });
        streamApi(res, stream, path, next);
    });
    router.get('/download/custom/*', logger(), async (req, res, next) => {
        const path = req.params[0];
        try {
            await customStorage(res, path, downloadApi, storageResultsThreshold, next);
        }
        catch (e) {
            next(handleStorageError(e, 'value', path));
        }
    });
    router.get('/download/*', logger(), async (req, res, next) => {
        const path = req.params[0];
        const stream = await storage.getStream({ path });
        downloadApi(res, stream, path, next);
    });

    return router;
};

module.exports = routes;
