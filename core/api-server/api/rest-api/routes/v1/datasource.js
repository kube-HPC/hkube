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

// const getIdMiddleware = async (req, res, next) => {
//     const { name } = req.params;
//     const entry = await dataSource.fetchDataSource(name);
//     req.dataSource = entry;
//     next();
// };

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
            try {
                const response = await dataSource.createDataSource(name, req.file);
                res.status(HttpStatus.CREATED).json(response);
            }
            finally {
                req.file && await fse.remove(req.file.path);
            }
            next();
        });

    router
        .route('/:name')
        .get(async (req, res, next) => {
            const { name } = req.params;
            const dataSourceEntry = await dataSource.fetchDataSource(name);
            const { files, ...rest } = dataSourceEntry;
            res.json({
                ...rest,
                path: `datasource/${name}`,
                files
            });
            next();
        })
        .put(upload.single('file'), async (req, res, next) => {
            const { name } = req.params;
            try {
                const file = await dataSource.updateDataSource(name, req.file);
                res.json({
                    path: `/datasource/${name}/${file.fileName}`,
                    name: file.fileName
                });
            }
            finally {
                req.file && await fse.remove(req.file.path);
            }
            next();
        }).delete(async (req, res, next) => {
            const { name } = req.params;
            const deletedId = await dataSource.delete(name);
            res.json({ deleted: deletedId });
            next();
        });

    router.get('/:name/:fileName', async (req, res, next) => {
        // TODO:: the stream need to handle both id and name instead of just getting a dataSource filed
        // consider splitting it to dataSource: {id: string} | {name: string}
        // this name or id should be a type it is common all over the system
        const { name, fileName } = req.params;
        try {
            const stream = await dataSource.fetchFile(name, fileName);
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
