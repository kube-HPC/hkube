const { Router } = require('express');
const multer = require('multer');
const HttpStatus = require('http-status-codes');
const fse = require('fs-extra');
const { InvalidDataError } = require('../../../../lib/errors');
const dataSource = require('../../../../lib/service/dataSource');
const snapshots = require('../../../../lib/service/snapshots');
const dbErrorsMiddleware = require('./../../middlewares/dbErrors');

const upload = multer({ dest: 'uploads/datasource/' });

const cleanTmpFile = async (files = []) => {
    if (files.length > 0) {
        await Promise.all(files.map(file => fse.remove(file.path)));
    }
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
                    files: req.files,
                });
                res.status(HttpStatus.CREATED).json(response);
            } finally {
                await cleanTmpFile(req.files);
            }
            next();
        });

    router.route('/id/:id').get(async (req, res, next) => {
        const { id } = req.params;
        const dataSourceEntry = await dataSource.fetchDataSource({ id });

        const { files, ...rest } = dataSourceEntry;
        res.json({
            ...rest,
            path: `datasource/id/${dataSourceEntry.id}`,
            files,
        });
        next();
    });

    router
        .route('/:name')
        .get(async (req, res, next) => {
            /** @type {{ version_id: string }} */
            const { version_id: versionId } = req.query;
            const { name } = req.params;
            let dataSourceEntry;
            if (versionId) {
                dataSourceEntry = await dataSource.fetchDataSource({
                    id: versionId,
                });
                if (dataSourceEntry?.name !== name) {
                    throw new InvalidDataError(
                        `version_id ${versionId} does not exist for name ${name}`
                    );
                }
            } else {
                dataSourceEntry = await dataSource.fetchDataSource({ name });
            }

            const { files, ...rest } = dataSourceEntry;
            res.json({
                ...rest,
                path: `datasource/${name}`,
                files,
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
                        added: req.files,
                        dropped: droppedFileIds
                            ? JSON.parse(droppedFileIds)
                            : undefined,
                        mapping: mapping ? JSON.parse(mapping) : undefined,
                    },
                });
                if (createdVersion) {
                    res.status(HttpStatus.CREATED).json(createdVersion);
                } else {
                    res.sendStatus(HttpStatus.OK);
                }
            } finally {
                await cleanTmpFile(req.files);
            }
            next();
        })
        .delete(async (req, res, next) => {
            const { name } = req.params;
            const response = await dataSource.deleteDataSource({ name });
            res.json(response);
            next();
        });

    router.get('/:name/versions', async (req, res, next) => {
        const { name } = req.params;
        const versions = await dataSource.listVersions(name);
        res.json(versions);
        return next();
    });

    router
        .post('/:name/snapshot', async (req, res, next) => {
            /** @type {{ version_id: string }} */
            const { version_id: id } = req.query;
            const { name, query } = req.body;
            const response = await snapshots.create({
                dataSource: {
                    id,
                    name: req.params.name,
                },
                name,
                query,
            });
            res.json(response);
            next();
        })
        .get('/id/:id/snapshot', async (req, res, next) => {
            const response = await snapshots.fetchAll({ id: req.params.id });
            res.json(response);
            next();
        })
        .get('/:name/snapshot/:snapshotName', async (req, res, next) => {
            const shouldResolve = req.query.resolve === 'true';
            let response;
            if (shouldResolve) {
                response = await snapshots.fetchDataSource({
                    dataSourceName: req.params.name,
                    snapshotName: req.params.snapshotName,
                });
            } else {
                response = await snapshots.fetch({
                    dataSourceName: req.params.name,
                    snapshotName: req.params.snapshotName,
                });
            }
            res.json(response);
            next();
        });

    router.use(dbErrorsMiddleware);
    return router;
};

module.exports = routes;
