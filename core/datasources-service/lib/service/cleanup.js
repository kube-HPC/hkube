const fse = require('fs-extra');
const log = require('@hkube/logger').GetLogFromContainer();
const dbConnection = require('../db');
const { getDatasourcesInUseFolder } = require('../utils/pathUtils');
const glob = require('./../utils/glob');
/** @typedef {import('./../utils/types').config} config */

class Cleanup {
    /** @param {config} config */
    async init(config) {
        this.config = config;
        this.db = dbConnection.connection;
        this.rootDir = getDatasourcesInUseFolder(config);
        this.keepHotDuration = config.keepDataSourceHotDuration;
    }

    _extractIds(collection) {
        return collection
            .flatMap(({ nodes }) => nodes)
            .map(({ dataSource }) => dataSource.id || dataSource.snapshot.name);
    }

    async subtractDirs() {
        const active = await this.db.jobs.scanMountedDataSources({
            returnActiveJobs: true,
        });
        const inactive = await this.db.jobs.scanMountedDataSources({
            returnActiveJobs: false,
            inactiveTime: this.keepHotDuration,
            inactiveTimeUnits: 'ms',
        });

        const protectedIds = new Set(this._extractIds(active));
        const dropCandidates = new Set(this._extractIds(inactive));

        const cleanup = [...dropCandidates].filter(id => !protectedIds.has(id));
        const directories = await Promise.all(
            cleanup.map(id => glob(`**/${id}`, this.rootDir))
        );

        await Promise.all(
            directories.map(([dir]) => {
                const path = `${this.rootDir}/${dir}`;
                log.debug(`removing dir ${path}`);
                return fse.remove(path);
            })
        );
    }
}

module.exports = new Cleanup();
