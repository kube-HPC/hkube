const storage = require('@hkube/storage-manager');
const { errorTypes } = require('@hkube/db/lib/errors');
const fse = require('fs-extra');
const { connection: db } = require('../db');
const { ResourceExistsError } = require('../errors');
const validator = require('../validation/api-validator');

/**
 *  @typedef {import('@hkube/db/lib/DataSource').DataSource} DataSourceItem;
 *  @typedef {import('express')} Express;
 *  @typedef {{createdPath: string, fileName: string}} uploadFileResponse
 * */

class DataSource {
    /**
     * @param {string} dataSourceId
     * @param {Express.Multer.File} file
     */
    async updateDataSource(dataSourceId, file) {
        validator.dataSource.validateUploadFile({ file });
        return this.uploadFile(dataSourceId, file);
    }

    /** @type {(dataSourceId: string, file: Express.Multer.File) => Promise<uploadFileResponse>} */
    async uploadFile(dataSourceId, file) {
        let createdPath = null;
        try {
            createdPath = await storage.hkubeDataSource.putStream({
                dataSource: dataSourceId,
                data: fse.createReadStream(file.path),
                fileName: file.originalname
            });
        }
        finally {
            await fse.remove(file.path);
        }
        return { createdPath, fileName: file.originalname };
    }

    /** @type {(name: string, file: Express.Multer.File) => Promise<DataSourceItem>} */
    async createDataSource(name, file) {
        validator.dataSource.validateCreate({ name, file });
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
        const [deletedId] = await Promise.all([
            db.dataSources.delete(id),
            storage.hkubeDataSource.delete({ dataSource: id })
        ]);
        return deletedId;
    }

    async list() {
        return db.dataSources.fetchAll();
    }
}

module.exports = new DataSource();
