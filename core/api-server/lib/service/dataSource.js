const storage = require('@hkube/storage-manager');
const { errorTypes } = require('@hkube/db/lib/errors');
const fse = require('fs-extra');
const dbConnection = require('../db');
const { ResourceExistsError } = require('../errors');

/** @typedef {import('@hkube/db/lib/DataSource').DataSource} DataSourceItem */
/** @typedef {import('express')} Express */

class DataSource {
    /**
     * @param {string} dataSourceID
     * @param {Express.Multer.File} file
     * @returns {Promise<{ createdPath: string, fileName: string }>}
     */
    async uploadFile(dataSourceID, file) {
        const createdPath = await storage.hkubeDataSource.putStream({
            dataSource: dataSourceID,
            data: fse.createReadStream(file.path),
            fileName: file.originalname
        });
        return { createdPath, fileName: file.originalname };
    }

    /** @type {(name: string, file: Express.Multer.File) => Promise<DataSourceItem> } */
    async createDataSource(name, file) {
        const db = dbConnection.connection;
        let createdDataSource = null;
        try {
            createdDataSource = await db.dataSources.create(name);
            await this.uploadFile(createdDataSource.id, file);
        }
        catch (error) {
            if (error.type === errorTypes.CONFLICT) {
                throw new ResourceExistsError('dataSource', name);
            }
            await db.dataSources.delete(createdDataSource.id, { allowNotFound: true }); // rollback
            throw error;
        }
        return createdDataSource;
    }

    /** @type { (id: string) => Promise<DataSourceItem & {files: string[] }> } */
    async fetchDataSource(id) {
        const db = dbConnection.connection;
        const dataSource = await db.dataSources.fetch({ id });
        /** @type {{path: string}[]} */
        const files = await storage.hkubeDataSource.list({ dataSource: dataSource.id.toString() });
        return { ...dataSource, files: files.map(file => file.path) };
    }

    /** @type {(dataSourceId: string, fileName: string) => Promise<string>} */
    async fetchFile(dataSourceId, fileName) {
        return storage.hkubeDataSource.getStream({ dataSource: dataSourceId, fileName });
    }

    /** @param {string} id */
    async delete(id) {
        const db = dbConnection.connection;
        return Promise.all([
            db.dataSources.delete(id),
            storage.hkubeDataSource.delete({ dataSource: id })
        ]);
    }

    async list() {
        const db = dbConnection.connection;
        return db.dataSources.fetchAll();
    }
}

module.exports = new DataSource();
