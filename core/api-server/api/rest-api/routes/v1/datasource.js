const path = require('path');
const { isDBError, errorTypes } = require('@hkube/db/lib/errors');
const { Router } = require('express');
const multer = require('multer');
const { ResourceNotFoundError, InvalidDataError } = require('../../../../lib/errors');
const dataSource = require('../../../../lib/service/dataSource');
const { promisifyStream } = require('../../../../lib/stream');

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
        href: `datasource/${dataSourceId}/${parsed.base}`
    };
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
            const dataSourceEntry = await dataSource.fetchDataSource(id);
            const { files, ...rest } = dataSourceEntry;
            return res.json({
                dataSource: {
                    ...rest,
                    href: `datasource/${id}`,
                    files: files.map(extractFileMeta(id))
                }
            });
        })
        .put(upload.single('file'), async (req, res) => {
            const { id } = req.params;
            const file = await dataSource.uploadFile(id, req.file);
            return res.json({
                file: {
                    href: `/datasource/${id}/${file.fileName}`,
                    name: file.fileName
                }
            });
        }).delete(async (req, res) => {
            const { id } = req.params;
            const deletedId = await dataSource.delete(id);
            return res.json({ deleted: deletedId });
        });

    router.get('/:id/:fileName', async (req, res) => {
        const { id, fileName } = req.params;
        // const stream = await dataSource.fetchFile(id, fileName);
        try {
            const stream = await dataSource.fetchFile(id, fileName);
            await promisifyStream(res, stream);
        }
        catch (error) {
            if (error.code === 'ENOENT') {
                throw new ResourceNotFoundError('dataSource/file', `${id}/${fileName}`);
            }
            throw new InvalidDataError(error.message);
        }
    });
    router.use(errorsMiddleware);
    return router;
};

module.exports = routes;
