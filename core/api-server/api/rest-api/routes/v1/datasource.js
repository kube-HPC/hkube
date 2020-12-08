const { isDBError, errorTypes } = require('@hkube/db/lib/errors');
const { Router } = require('express');
const multer = require('multer');
const HttpStatus = require('http-status-codes');
const fse = require('fs-extra');
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

const cleanTmpFile = async (files = []) => {
    files.length > 0 && await Promise.all(files.map(file => fse.remove(file.path)));
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
        .post(upload.array('files'), async (req, res, next) => {
            const { name } = req.body;
            try {
                const response = await dataSource.createDataSource({
                    name,
                    files: req.files
                });
                res.status(HttpStatus.CREATED).json(response);
            }
            finally {
                await cleanTmpFile(req.files);
            }
            next();
        });
    router
        .route('/id/:id')
        .get(async (req, res, next) => {
            const { id } = req.params;
            const dataSourceEntry = await dataSource.fetchDataSource({ id });

            const { files, ...rest } = dataSourceEntry;
            res.json({
                ...rest,
                path: `datasource/id/${dataSourceEntry.id}`,
                files
            });
            next();
        });
    router
        .route('/:name')
        .get(async (req, res, next) => {
            /** @type {{version_id: string}} */
            // @ts-ignore
            const { version_id: versionId } = req.query;
            const { name } = req.params;
            let dataSourceEntry;
            if (versionId) {
                dataSourceEntry = await dataSource.fetchDataSource({ id: versionId });
                if (dataSourceEntry?.name !== name) {
                    throw new InvalidDataError(`version_id ${versionId} does not exist for name ${name}`);
                }
            }
            else {
                dataSourceEntry = await dataSource.fetchDataSource({ name });
            }

            const { files, ...rest } = dataSourceEntry;
            res.json({
                ...rest,
                path: `datasource/${name}`,
                files
            });
            next();
        })
        .post(upload.array('files'), async (req, res, next) => {
            const { name } = req.params;
            const { versionDescription, droppedFileIds, mapping } = req.body;
            try {
                const createdVersion = await dataSource.updateDataSource({
                    name,
                    versionDescription,
                    files: {
                        // @ts-ignore
                        added: req.files,
                        dropped: droppedFileIds ? JSON.parse(droppedFileIds) : undefined,
                        mapping: mapping ? JSON.parse(mapping) : undefined
                    }
                });
                if (createdVersion) {
                    res.status(HttpStatus.CREATED).json(createdVersion);
                }
                else {
                    res.sendStatus(HttpStatus.OK);
                }
            }
            finally {
                await cleanTmpFile(req.files);
            }
            next();
        }).delete(async (req, res, next) => {
            const { name } = req.params;
            const deletedId = await dataSource.delete({ name });
            res.json({ deleted: deletedId });
            next();
        });

    router.get('/:name/:fileName', async (req, res, next) => {
        // TODO:: the stream need to handle both id and name instead of just getting a dataSource filed
        // consider splitting it to dataSource: {id: string} | {name: string}
        // this name or id should be a type it is common all over the system
        const { name, fileName } = req.params;
        try {
            const stream = await dataSource.fetchFile({ dataSourceName: name, fileName });
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
