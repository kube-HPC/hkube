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
const ensureArray = require('../../../../lib/utils/ensureArray');

const upload = multer({ dest: 'uploads/datasource/' });

const cleanTmpFile = async (files = []) => {
    if (files.length > 0) {
        await Promise.all(files.map(file => fse.remove(file.path)));
    }
};

const routes = () => {
    const router = Router();

    // ---- validate ---- //
    router.get('/validate', async (req, res, next) => {
        /** @type {any} */
        const { name, id, snapshot_name: snapshotName } = req.query;
        const { id: resultedId } = await validation.dataSourceExists({
            name,
            id,
            snapshot: { name: snapshotName },
        });
        res.json({ exists: true, id: resultedId });
        next();
    });

    router
        .route('/')
        .get(async (req, res, next) => {
            const dataSources = await dataSource.list();
            res.json(dataSources);
            next();
        })
        .post(upload.array('files'), async (req, res, next) => {
            const {
                files,
                body: { name, storage, git },
            } = req;
            let gitConfig;
            let storageConfig;
            try {
                gitConfig = git ? JSON.parse(git) : undefined;
                storageConfig = storage ? JSON.parse(storage) : undefined;
            } catch (error) {
                throw new InvalidDataError(
                    "invalid 'git' or 'storage' settings provided"
                );
            }
            try {
                const response = await dataSource.create({
                    name,
                    storage: storageConfig,
                    git: gitConfig,
                    files: req.files,
                });
                res.status(HttpStatus.CREATED).json(response);
            } finally {
                await cleanTmpFile(files);
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
            /** @type {any} */
            const {
                query: { id },
                params: { name },
            } = req;
            let dataSourceEntry;
            if (id) {
                dataSourceEntry = await dataSource.fetch({ id });
                if (dataSourceEntry?.name !== name) {
                    throw new InvalidDataError(
                        `id ${id} does not exist for name ${name}`
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
            const {
                versionDescription,
                droppedFileIds,
                mapping: _mapping,
            } = req.body;
            const mapping = ensureArray(_mapping, 'mapping');
            const droppedIds = ensureArray(droppedFileIds, 'droppedFileIds');
            try {
                const createdVersion = await dataSource.update({
                    name,
                    versionDescription,
                    files: {
                        added: req.files,
                        dropped: droppedIds.length > 0 ? droppedIds : undefined,
                        mapping: mapping.length > 0 ? mapping : undefined,
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

    // ---- versions ---- //
    router.get('/:name/versions', async (req, res, next) => {
        const { name } = req.params;
        const versions = await dataSource.listVersions(name);
        res.json(versions);
        return next();
    });

    // ---- snapshots ---- //
    router
        .route('/:name/snapshot')
        .post(async (req, res, next) => {
            const response = await snapshots.create(req.body.snapshot, {
                name: req.params.name,
            });
            res.json(response);
            next();
        })
        .get(async (req, res, next) => {
            const response = await snapshots.fetchAll({
                name: req.params.name,
            });
            res.json(response);
            next();
        });
    router.post('/id/:id/snapshot', async (req, res, next) => {
        const response = await snapshots.create(req.body.snapshot, {
            id: req.params.id,
        });
        res.json(response);
        next();
    });
    router.post('/id/:id/snapshot/preview', async (req, res, next) => {
        const files = await snapshots.previewSnapshot({
            id: req.params.id,
            query: req.body.query,
        });
        res.json(files);
        next();
    });

    router.get('/:name/snapshot/:snapshotName', async (req, res, next) => {
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

    // ---- download ---- //
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

    router.post('/:name/sync', async (req, res, next) => {
        const { name } = req.params;
        const createdVersion = await dataSource.sync({ name });
        res.status(201).json(createdVersion);
        next();
    });

    router.use(dbErrorsMiddleware);
    return router;
};

module.exports = routes;
