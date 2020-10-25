const storage = require('@hkube/storage-manager');
const { errorTypes } = require('@hkube/db/lib/errors');
const fse = require('fs-extra');
const dbConnection = require('../db');
const validator = require('../validation/api-validator');
const { InvalidDataError, ResourceExistsError } = require('../errors');

/** @typedef {import('@hkube/db/lib/DataSource').DataSource} DataSourceItem */

class DataSource {
    /** @param {Express.Multer.File} file */
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
        validator.dataSource.validateCreate({ name });
        if (!file) {
            throw new InvalidDataError('no file was submitted');
        }
        const db = dbConnection.connection;
        let createdDataSource = null;
        try {
            createdDataSource = await db.dataSources.create(name);
        }
        catch (error) {
            if (error.type === errorTypes.CONFLICT) {
                throw new ResourceExistsError('dataSource', name);
            }
            throw error;
        }
        await this.uploadFile(createdDataSource.id, file);
        return createdDataSource;
    }

    async list() {
        return [];
    }

    /** @type { (id: string) => Promise<DataSourceItem & {files: string[] }> } */
    async fetchDataSource(id) {
        const db = dbConnection.connection;
        const dataSource = await db.dataSources.fetch({ id });
        /**
         * @typedef {{path: string}} responseFile
         * @type {responseFile[]}
         * */
        const files = await storage.hkubeDataSource.list({ dataSource: dataSource.id.toString() });
        return { ...dataSource, files: files.map(file => file.path) };
    }

    /**
     * @param {string} dataSourceId
     * @param {string} fileName
     * */
    async fetchFile(dataSourceId, fileName) {
        return storage.hkubeDataSource.getStream({ dataSource: dataSourceId, fileName });
    }

    async delete(id) {
        const db = dbConnection.connection;
        return db.dataSources.delete(id);
    }
}

module.exports = new DataSource();
