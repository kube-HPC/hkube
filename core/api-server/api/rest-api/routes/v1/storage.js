const RestServer = require('@hkube/rest-server');
const storage = require('../../../../lib/service/storage');
const {
    handleStorageError,
    handleStreamError,
    promisifyStream,
    downloadApi
} = require('../../../../lib/stream');

const routes = (options) => {
    const router = RestServer.router();

    router.get('/', (req, res, next) => {
        res.json({ message: `${options.version} ${options.file} api` });
        next();
    });
    router.get('/info', async (req, res, next) => {
        const response = await storage.getInfo();
        res.json(response);
        next();
    });
    router.get('/prefix/types', (req, res, next) => {
        res.json(storage.prefixesTypes);
        next();
    });
    router.get('/prefixes', async (req, res, next) => {
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
    router.get('/prefixes/*', async (req, res, next) => {
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
    router.get('/keys', async (req, res, next) => {
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
    router.get('/keys/*', async (req, res, next) => {
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
    router.get('/values/*', async (req, res, next) => {
        const path = req.params[0];
        try {
            const metadata = await storage.getMetadata({ path });
            const result = storage.checkDataSize(metadata.size);
            if (result.error) {
                throw new Error(result.error);
            }
            const response = await storage.getByPath({ path });
            res.json(response);
            next();
        }
        catch (e) {
            next(handleStorageError(e, 'value', path));
        }
    });
    router.get('/stream/custom/*', async (req, res, next) => {
        const path = req.params[0];
        try {
            const stream = await storage.getCustomStream({ path });
            await promisifyStream(res, stream);
        }
        catch (e) {
            handleStreamError(e, path, res, next);
        }
    });
    router.get('/stream/*', async (req, res, next) => {
        const path = req.params[0];
        try {
            const stream = await storage.getStream({ path });
            await promisifyStream(res, stream);
        }
        catch (e) {
            handleStreamError(e, path, res, next);
        }
    });
    router.get('/download/custom/*', async (req, res, next) => {
        const path = req.params[0];
        const { ext } = req.query;
        try {
            const stream = await storage.getCustomStream({ path });
            await downloadApi(res, stream, ext);
        }
        catch (e) {
            handleStreamError(e, path, res, next);
        }
    });
    router.get('/download/pipeline/result/*', async (req, res, next) => {
        const jobId = req.params[0];
        try {
            const stream = await storage.getPipelineResult({ jobId });
            await downloadApi(res, stream, 'zip');
        }
        catch (e) {
            handleStreamError(e, 'path', res, next);
        }
    });
    router.get('/download/*', async (req, res, next) => {
        const path = req.params[0];
        const { ext } = req.query;
        try {
            const stream = await storage.getStream({ path });
            await downloadApi(res, stream, ext);
        }
        catch (e) {
            handleStreamError(e, path, res, next);
        }
    });
    return router;
};

module.exports = routes;
