const fse = require('fs-extra');
const { Consumer } = require('@hkube/producer-consumer');
const { taskStatuses } = require('@hkube/consts');
const storageManager = require('@hkube/storage-manager');
const log = require('@hkube/logger').GetLogFromContainer();
const component = require('../consts/componentNames').MAIN;
const Etcd = require('../Etcd');
const dbConnection = require('../db');
const Repository = require('../utils/Repository');
const getFilePath = require('../utils/getFilePath');
/**
 * @typedef {import('./../utils/types').config} config
 * @typedef {import('./types').onJobHandler} onJobHandler
 * @typedef {import('./types').PipelineDatasourceDescriptor} PipelineDatasourceDescriptor
 * @typedef {import('@hkube/db/lib/DataSource').FileMeta} FileMeta
 * @typedef {import('./types').Job} Job
 */

class JobConsumer {
    constructor() {
        this._inactiveTimer = null;
    }

    handleFail({ jobId, taskId, error }) {
        log.error(error, { component, taskId });
        return this.state.update({
            jobId,
            taskId,
            endTime: Date.now(),
            status: taskStatuses.FAILED,
            error,
        });
    }

    setActive(job) {
        return this.state.set({
            ...job,
            podName: this.config.podName,
            startTime: Date.now(),
            status: taskStatuses.ACTIVE,
        });
    }

    /** @returns {{ filesToKeep: FileMeta[]; filesToDelete: FileMeta[] }} */
    filterFilesList(files, query) {
        const queryRegexp = new RegExp(query, 'i');
        return files.reduce(
            (acc, file) =>
                file.meta.match(queryRegexp)
                    ? {
                          ...acc,
                          filesToKeep: acc.filesToKeep.concat(file),
                      }
                    : {
                          ...acc,
                          filesToDelete: acc.filesToDelete.concat(file),
                      },
            {
                filesToKeep: [],
                filesToDelete: [],
            }
        );
    }

    /** @param {Job} props */
    async fetchDataSource({ dataSource: dataSourceDescriptor, ...job }) {
        const { jobId, taskId } = job;
        log.info(`got job, starting to fetch dataSource`, {
            component,
            taskId,
        });
        await this.setActive(job);

        let dataSource;
        const { snapshotName } = dataSourceDescriptor;
        let resolvedSnapshot;
        try {
            if (snapshotName) {
                resolvedSnapshot = await this.db.snapshots.fetchDataSource({
                    snapshotName,
                    dataSourceName: dataSourceDescriptor.name,
                });
                dataSource = resolvedSnapshot.dataSource;
            } else {
                const shouldGetLatest = !dataSourceDescriptor.version;
                dataSource = await this.db.dataSources.fetch(
                    shouldGetLatest
                        ? { name: dataSourceDescriptor.name }
                        : { id: dataSourceDescriptor.version }
                );
            }
        } catch (e) {
            return this.handleFail({ ...job, error: e.message });
        }

        const repository = new Repository(
            dataSourceDescriptor.name,
            this.config,
            `${this.rootDir}/${jobId}`
        );

        try {
            log.info(`starting to clone dataSource ${dataSource.name}`, {
                component,
                taskId,
            });
            await repository.ensureClone(dataSource.versionId);
            await repository.pullFiles();
        } catch (e) {
            return this.handleFail({
                ...job,
                error: `could not clone the datasource ${dataSource.name}. ${e.message}`,
            });
        }

        let filesList = dataSource.files;
        if (resolvedSnapshot) {
            let filesToDelete;
            if (resolvedSnapshot.filteredFilesList) {
                filesList = resolvedSnapshot.filteredFilesList;
                filesToDelete = resolvedSnapshot.droppedFiles;
            } else {
                const categorizedList = this.filterFilesList(
                    filesList,
                    resolvedSnapshot.query
                );
                filesList = categorizedList.filesToKeep;
                filesToDelete = categorizedList.filesToDelete;
                await this.db.snapshots.updateFilesList({
                    id: resolvedSnapshot.id,
                    filesList,
                    droppedFiles: filesToDelete,
                });
            }
            await repository.filterFilesFromClone(filesToDelete);
        }

        filesList = filesList.map(fileMeta => ({
            ...fileMeta,
            fullPath: `${job.jobId}/${dataSource.name}/${getFilePath(
                fileMeta
            )}`,
        }));

        await this.storeResult({ filesList, ...job });

        log.info(
            `successfully cloned and stored dataSource ${dataSource.name}`,
            { component, taskId }
        );
        return null;
    }

    /** @param {{ payload: FileMeta[] } & Job} props */
    async storeResult({ filesList, ...job }) {
        const { jobId, taskId } = job;
        try {
            /** @type {{ path: string }} */
            const filesStorageInfo = await storageManager.hkube.put({
                jobId,
                taskId: `${taskId}-0`,
                data: filesList,
            });
            const linkStorageInfo = await storageManager.hkube.put({
                jobId,
                taskId,
                data: filesStorageInfo,
            });
            await this.state.update({
                ...job,
                status: taskStatuses.STORING,
                result: { storageInfo: linkStorageInfo },
            });
            await this.db.snapshots.updateFilesList({});
            await this.state.update({
                ...job,
                endTime: Date.now(),
                status: taskStatuses.SUCCEED,
            });
        } catch (e) {
            return this.handleFail({
                ...job,
                error: `failed storing datasource ${job.dataSource.name}. ${e.message}`,
            });
        }
        return null;
    }

    unmountDataSource(jobId) {
        return fse.remove(`${this.rootDir}/${jobId}`);
    }

    /**
     * Init the consumer and register for jobs, initialize connection to the state manager
     *
     * @param {config} config
     */
    async init(config) {
        this.config = config;
        await fse.ensureDir(config.directories.dataSourcesInUse);
        const { type, prefix } = config.jobs.consumer;
        const consumerSettings = {
            job: { type, prefix },
            setting: {
                redis: config.redis,
                prefix,
            },
        };
        this.rootDir = this.config.directories.dataSourcesInUse;
        this.state = new Etcd(config);
        this.consumer = new Consumer(consumerSettings);
        this.consumer.register(consumerSettings);
        /** @type {import('@hkube/db/lib/MongoDB').ProviderInterface} */
        this.db = dbConnection.connection;
        await this.state.startWatch();
        // register to events
        this.consumer.on(
            'job',
            /** @type {onJobHandler} */
            async job => {
                await this.fetchDataSource(job.data);
                job.done(); // send job done to redis
            }
        );

        this.state.onDone(job => {
            this.unmountDataSource(job.jobId);
        });
    }
}

module.exports = new JobConsumer();
