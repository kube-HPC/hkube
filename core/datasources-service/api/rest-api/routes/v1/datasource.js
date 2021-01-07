const { Router } = require('express');
const multer = require('multer');
const HttpStatus = require('http-status-codes');
const fse = require('fs-extra');
const log = require('@hkube/logger').GetLogFromContainer();
const component = require('../../../../lib/consts/componentNames').MAIN;
const { InvalidDataError } = require('../../../../lib/errors');
const dataSource = require('../../../../lib/service/dataSource');
const snapshots = require('../../../../lib/service/snapshots');
const downloads = require('../../../../lib/service/downloads');
const dbErrorsMiddleware = require('./../../middlewares/dbErrors');
const validation = require('./../../../../lib/service/validation');

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
                const response = await dataSource.create({
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
        const dataSourceEntry = await dataSource.fetch({ id });

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
                dataSourceEntry = await dataSource.fetch({ id: versionId });
                if (dataSourceEntry?.name !== name) {
                    throw new InvalidDataError(
                        `version_id ${versionId} does not exist for name ${name}`
                    );
                }
            } else {
                dataSourceEntry = await dataSource.fetch({ name });
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
            let droppedIds = [];
            try {
                droppedIds = JSON.parse(droppedFileIds);
            } catch (e) {
                if (typeof droppedFileIds === 'string') {
                    droppedIds = droppedFileIds.split(',').filter(item => item);
                } else if (Array.isArray(droppedFileIds)) {
                    droppedIds = droppedFileIds;
                }
            }

            try {
                const createdVersion = await dataSource.update({
                    name,
                    versionDescription,
                    files: {
                        added: req.files,
                        dropped: droppedIds.length > 0 ? droppedIds : undefined,
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
            const response = await dataSource.delete({ name });
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

    router
        .route('/id/:id/download')
        .post(async (req, res, next) => {
            const { id: dataSourceId } = req.params;
            const downloadId = await downloads.prepareForDownload({
                dataSourceId,
                fileIds: req.body.fileIds,
            });
            const href = `datasource/id/${dataSourceId}/download?download_id=${downloadId}`;
            res.status(201).json({ href });
            next();
        })
        .get(async (req, res, next) => {
            const { download_id: downloadId } = req.query;
            res.sendFile(
                downloads.getZipPath(downloadId),
                { root: '.' },
                err => {
                    if (!err) {
                        console.info('done, i should clear the file');
                    } else if (err.code === 'ENOENT') {
                        log.debug(`requested file ${downloadId} not existing`);
                    } else {
                        log.error(
                            'failed fetching zip file',
                            { component },
                            err
                        );
                    }
                    next();
                }
            );
        });

    router.get('/validate/:name', async (req, res, next) => {
        const {
            version_id: versionId,
            snapshot_name: snapshotName,
        } = req.query;
        const { name } = req.params;
        await validation.dataSourceExists({
            dataSourceName: name,
            snapshotName,
            versionId,
        });
        res.json({ exists: true });
        next();
    });

    router.use(dbErrorsMiddleware);
    return router;
};

module.exports = routes;
