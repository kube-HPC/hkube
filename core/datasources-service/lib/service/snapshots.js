const { ResourceNotFoundError } = require('../errors');
const validator = require('../validation');
const dbConnection = require('../db');

/**
 * @typedef {import('./../utils/types').config} config
 * @typedef {import('@hkube/db/lib/Snapshots').Snapshot} Snapshot;
 * @typedef {import('@hkube/db/lib/DataSource').FileMeta} FileMeta
 * @typedef {import('@hkube/db/lib/DataSource').DataSource} DataSource
 */

class Snapshots {
    /** @param {config} config */
    async init(config) {
        this.config = config;
        this.db = dbConnection.connection;
    }

    async fetchAll({ name }) {
        return this.db.snapshots.fetchAll({
            query: { 'dataSource.name': name },
        });
    }

    /**
     * @type {(
     *     snapshot: { name: string; query: string },
     *     dataSource: { name?: string; id?: string }
     * ) => Promise<Snapshot>}
     */
    async create(snapshot, { name, id }) {
        validator.snapshots.validateSnapshot({
            ...snapshot,
            dataSource: { id, name },
        });
        const dataSourceEntry = await this.db.dataSources.fetch({ id, name });
        const dataSource = {
            id: dataSourceEntry.id,
            name: dataSourceEntry.name,
        };
        const { matching, nonMatching } = this.filterFilesListByQuery({
            files: dataSourceEntry.files,
            query: snapshot.query,
        });
        return this.db.snapshots.create(
            {
                ...snapshot,
                dataSource,
                filteredFilesList: matching,
                droppedFiles: nonMatching,
            },
            { applyId: true }
        );
    }

    async fetch({ dataSourceName, snapshotName }) {
        return this.db.snapshots.fetch(
            { name: snapshotName, 'dataSource.name': dataSourceName },
            { allowNotFound: false }
        );
    }

    async fetchDataSource({ dataSourceName, snapshotName }) {
        const response = await this.db.snapshots.fetchDataSource({
            dataSourceName,
            snapshotName,
        });
        if (!response) {
            throw new ResourceNotFoundError('snapshot', snapshotName);
        }
        return response;
    }

    /**
     * @param {{ files: FileMeta[]; query: string }} props
     * @returns {{ matching: FileMeta[]; nonMatching: FileMeta[] }}
     */
    filterFilesListByQuery({ files, query }) {
        const queryRegexp = new RegExp(query, 'i');
        return files.reduce(
            (acc, file) =>
                file.meta.match(queryRegexp)
                    ? {
                          ...acc,
                          matching: acc.matching.concat(file),
                      }
                    : {
                          ...acc,
                          nonMatching: acc.nonMatching.concat(file),
                      },
            { matching: [], nonMatching: [] }
        );
    }

    async previewSnapshot({ id, query }) {
        validator.snapshots.validatePreview({ id, query });
        const { files } = await this.db.dataSources.fetch(
            { id },
            { fields: { files: 1 } }
        );
        return this.filterFilesListByQuery({ files, query }).matching;
    }
}

module.exports = new Snapshots();
