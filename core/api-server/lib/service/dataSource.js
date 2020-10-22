const storage = require('@hkube/storage-manager');
const { errorTypes } = require('@hkube/db/lib/errors');
const dbConnection = require('../db');
const validator = require('../validation/api-validator');
const { InvalidDataError, ResourceExistsError } = require('../errors');

/** @typedef {import('@hkube/db/lib/DataSource').DataSource} DataSourceItem */

class DataSource {
    /** @param {Express.Multer.File} file */
    async uploadFile(dataSourceID, file) {
        storage.hkubeDataSource.putStream({
            dataSource: dataSourceID,
            data: file.stream,
            fileName: file.originalname
        });
        return file.originalname;
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
        // await this.uploadFile(id, file);
        return createdDataSource;
    }

    async list() {
        return [];
    }

    /** @param {string} id */
    async fetchDataSource(id) {
        console.log({ id });
        // fetch the dataSource from the db
        // list all the files from the storage
        return id;
    }

    /**
     * @param {string} dataSourceId
     * @param {string} fileName
     * */
    async fetchFile(dataSourceId, fileName) {
        console.log({ dataSourceId, fileName });
        return "";
    }
}

module.exports = new DataSource();
