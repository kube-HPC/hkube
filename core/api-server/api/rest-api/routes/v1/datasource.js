const { isDBError, errorTypes } = require('@hkube/db/lib/errors');
const { Router } = require('express');
const { lchown } = require('fs-extra');
const multer = require('multer');
const { ResourceNotFoundError } = require('../../../../lib/errors');
const InvalidDataError = require('../../../../lib/errors/InvalidDataError');
const upload = multer({ dest: 'uploads/datasource/' });
// consider replacing multer with busboy to handle the stream without saving to disk
const dataSource = require('../../../../lib/service/dataSource');
const validation = require('../../../../lib/validation');

const errorsMiddleware = (error, req, res, next) => {
    if (isDBError(error)) {
        if (error.type === errorTypes.NOT_FOUND) {
            throw new ResourceNotFoundError('dataSource', error.metaData.id);
        }
        throw new InvalidDataError(error.message);
    }
    return next(error);
};

const routes = () => {
    const router = Router();
    router
        .route('/')
        .get(async (req, res) => {
            const dataSources = await dataSource.list();
            res.json(dataSources);
        })
        .post(upload.single('file'), async (req, res) => {
            const { name } = req.body;
            const response = await dataSource.createDataSource(name, req.file);
            // // create the data source on the db
            // // upload file to storage
            // console.log({ name, fileName });
            return res.status(201).json(response);
        });

    router
        .route('/:id')
        .get(async (req, res) => {
            const { id } = req.params;
            const response = await dataSource.fetchDataSource(id);
            return res.json({ dataSource: response });
        })
        .put(upload.single('file'), async (req, res) => {
            const { id } = req.params;
            const fileName = await dataSource.uploadFile(id, req.file);
            return res.json({ id, fileName });
        }).delete(async (req, res) => {
            const { id } = req.params;
            const deletedId = await dataSource.delete(id);
            return res.json({ deleted: deletedId });
        });

    router.get('/:id/:fileName', (req, res) => {
        const { id, fileName } = req.params;
        const stream = dataSource.fetchFile(id, fileName);
        // fetch file from the storage
        return res.sendStatus(501);
    });
    router.use(errorsMiddleware);
    return router;
};

module.exports = routes;
