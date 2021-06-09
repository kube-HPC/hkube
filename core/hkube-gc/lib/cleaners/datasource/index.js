const fse = require('fs-extra');
const { getDatasourcesInUseFolder } = require('./utils/pathUtils');
const { glob } = require('./utils/glob');
const storeManager = require('../../helpers/store-manager');
const BaseCleaner = require('../../core/base-cleaner');

class DataSourceCleaner extends BaseCleaner {
    constructor(config) {
        super(config);
        this.rootDir = getDatasourcesInUseFolder(this._config);
    }

    _extractIds(collection) {
        return collection
            .flatMap(({ nodes }) => nodes)
            .map(({ dataSource }) => dataSource.id || `${dataSource.name}/${dataSource.snapshot.name}`);
    }

    async clean({ maxAge } = {}) {
        const data = await this.fetch({ maxAge });
        await this.delete(data);
        return this.runResult({ data });
    }

    async dryRun({ maxAge } = {}) {
        const data = await this.fetch({ maxAge });
        return this.runResult({ data });
    }

    async fetch({ maxAge } = {}) {
        const maxJobAge = this.resolveMaxAge(maxAge, this._config.maxAge);
        const active = await storeManager.scanMountedDataSources({
            returnActiveJobs: true,
        });
        const inactive = await storeManager.scanMountedDataSources({
            returnActiveJobs: false,
            inactiveTime: maxJobAge,
            inactiveTimeUnits: 'minutes',
        });

        const protectedIds = new Set(this._extractIds(active));
        const dropCandidates = new Set(this._extractIds(inactive));
        const cleanup = [...dropCandidates].filter(id => !protectedIds.has(id));
        const dirs = await Promise.all(cleanup.map(id => glob(`**/${id}`, this.rootDir)));
        const result = dirs.filter(([dir]) => dir).map(([dir]) => `${this.rootDir}/${dir}`);
        return result;
    }

    async delete(data) {
        await Promise.all(data.map(p => fse.remove(p)));
    }
}

module.exports = DataSourceCleaner;
