const { Consumer } = require('@hkube/producer-consumer');
const { taskStatuses } = require('@hkube/consts');
const storageManager = require('@hkube/storage-manager');
const log = require('@hkube/logger').GetLogFromContainer();
const fse = require('fs-extra');
const Etcd = require('../Etcd');
const dbConnection = require('../db');
const Repository = require('../utils/Repository');
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
        log.error(error);
        return this.state.update({
            jobId,
            taskId,
            status: taskStatuses.FAILED,
            error,
        });
    }

    setActive(job) {
        return this.state.set({
            ...job,
            status: taskStatuses.ACTIVE,
        });
    }

    /** @param {Job} props */
    async fetchDataSource({ dataSource, ...job }) {
        const { jobId } = job;
        await this.setActive(job);

        const shouldGetLatest = !dataSource.version;
        let dataSourceEntry;
        try {
            dataSourceEntry = await this.db.dataSources.fetch(
                shouldGetLatest
                    ? { name: dataSource.name }
                    : { id: dataSource.version }
            );
        } catch (e) {
            return this.handleFail({
                ...job,
                error: `could not find the datasource ${dataSource.name}`,
            });
        }

        const repository = new Repository(
            dataSource.name,
            this.config,
            `${this.rootDir}/${jobId}`
        );

        try {
            await repository.ensureClone(dataSourceEntry.versionId);
            await repository.pullFiles();
        } catch (error) {
            return this.handleFail({
                ...job,
                error: `could not clone the datasource ${dataSource.name}`,
            });
        }

        let payload = dataSourceEntry.files;
        if (dataSource.query) {
            payload = await repository.filterFiles(
                dataSourceEntry.files,
                dataSource.query
            );
        }
        return this.storeResult({ payload, ...job });
    }

    /** @param {{ payload: FileMeta[] } & Job} props */
    async storeResult({ payload, ...job }) {
        const { jobId, taskId } = job;
        try {
            /** @type {{ path: string }} */
            const storageInfo = await storageManager.hkube.put({
                jobId,
                taskId,
                data: payload,
            });
            await this.state.update({
                ...job,
                status: taskStatuses.STORING,
                result: { storageInfo },
            });
            await this.state.update({
                ...job,
                status: taskStatuses.SUCCEED,
            });
        } catch (error) {
            return this.handleFail({
                ...job,
                error: `failed storing datasource ${job.dataSource.name}`,
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
