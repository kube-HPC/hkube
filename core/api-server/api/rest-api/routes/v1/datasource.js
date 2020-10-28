const path = require('path');
const { isDBError, errorTypes } = require('@hkube/db/lib/errors');
const { Router } = require('express');
const multer = require('multer');
const HttpStatus = require('http-status-codes');
const { ResourceNotFoundError, InvalidDataError } = require('../../../../lib/errors');
const dataSource = require('../../../../lib/service/dataSource');
const { promisifyStream, handleStorageError } = require('../../../../lib/stream');
// consider replacing multer with busboy to handle the stream without saving to disk
const upload = multer({ dest: 'uploads/datasource/' });

const errorsMiddleware = (error, req, res, next) => {
    if (isDBError(error)) {
        if (error.type === errorTypes.NOT_FOUND) {
            throw new ResourceNotFoundError('dataSource', error.metaData.id);
        }
        throw new InvalidDataError(error.message);
    }
    return next(error);
};

/** @type {(dataSourceId: string ) => (filePath: string) => {type: string, name: string, href: string}} */
const extractFileMeta = (dataSourceId) => (filePath) => {
    const parsed = path.parse(filePath);
    return {
        type: parsed.ext,
        name: parsed.base,
        path: `datasource/${dataSourceId}/${parsed.base}`
    };
};

const routes = () => {
    const router = Router();
    router
        .route('/')
        .get(async (req, res, next) => {
            const dataSources = await dataSource.list();
            res.json(dataSources);
            next();
        })
        .post(upload.single('file'), async (req, res, next) => {
            const { name } = req.body;
            const response = await dataSource.createDataSource(name, req.file);
            res.status(HttpStatus.CREATED).json(response);
            next();
        });

    router
        .route('/:id')
        .get(async (req, res, next) => {
            const { id } = req.params;
            const dataSourceEntry = await dataSource.fetchDataSource(id);
            const { files, ...rest } = dataSourceEntry;
            res.json({
                ...rest,
                path: `datasource/${id}`,
                files: files.map(extractFileMeta(id))
            });
            next();
        })
        .put(upload.single('file'), async (req, res, next) => {
            const { id } = req.params;
            const file = await dataSource.updateDataSource(id, req.file);
            res.json({
                path: `/datasource/${id}/${file.fileName}`,
                name: file.fileName
            });
            next();
        }).delete(async (req, res, next) => {
            const { id } = req.params;
            const deletedId = await dataSource.delete(id);
            res.status(HttpStatus.OK).json({ deleted: deletedId });
            next();
        });

    router.get('/:id/:fileName', async (req, res, next) => {
        const { id, fileName } = req.params;
        try {
            const stream = await dataSource.fetchFile(id, fileName);
            await promisifyStream(res, stream);
        }
        catch (error) {
            return next(handleStorageError(error, 'getFile', error.path));
        }
        return next();
    });
    router.use(errorsMiddleware);
    return router;
};

module.exports = routes;
