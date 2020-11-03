const storage = require('@hkube/storage-manager');
const { errorTypes, isDBError } = require('@hkube/db/lib/errors');
const fse = require('fs-extra');
const { connection: db } = require('../db');
const { ResourceExistsError, ResourceNotFoundError } = require('../errors');
const validator = require('../validation/api-validator');

/**
 *  @typedef {import('@hkube/db/lib/DataSource').DataSource} DataSourceItem;
 *  @typedef {import('express')} Express;
 *  @typedef {{createdPath: string, fileName: string}} uploadFileResponse
 *  @typedef {import('@hkube/storage-manager/lib/storage/storage-base').EntryWithMetaData} EntryWithMetaData
 *  @typedef {{name?: string; id?: string;}} NameOrId
 * */

class DataSource {
    /**
     * @param {object} props
     * @param {Express.Multer.File} props.file
     * @param {string} props.name
     */
    async updateDataSource({ name, file }) {
        validator.dataSource.validateUploadFile({ file });
        return this.uploadFile({ name, file });
    }

    /**
      * @param {object} query
      * @param {string} query.name
      * @param {Express.Multer.File} query.file
      */
    async uploadFile({ name, file }) {
        const createdPath = await storage.hkubeDataSource.putStream({
            dataSource: name,
            data: fse.createReadStream(file.path),
            fileName: file.originalname
        });
        return { createdPath, fileName: file.originalname };
    }

    /**
      * @param {object} query
      * @param {string} query.name
      * @param {Express.Multer.File} query.file
      */
    async createDataSource({ name, file }) {
        validator.dataSource.validateCreate({ name, file });
        let createdDataSource = null;
        try {
            createdDataSource = await db.dataSources.create(name);
            await this.uploadFile({ name, file });
        }
        catch (error) {
            if (error.type === errorTypes.CONFLICT) {
                throw new ResourceExistsError('dataSource', name);
            }
            await db.dataSources.delete({ name }, { allowNotFound: true }); // rollback
            throw error;
        }
        return createdDataSource;
    }

    /**
     * @param {object} query
     * @param {string} query.name
     */
    async fetchDataSourceMetaData({ name }) {
        let dataSource = null;
        try {
            dataSource = await db.dataSources.fetch({ name });
        }
        catch (error) {
            if (isDBError(error) && error.type === errorTypes.NOT_FOUND) {
                throw new ResourceNotFoundError('dataSource', name, error);
            }
            throw error;
        }
        return dataSource;
    }

    /**
     * @param {object} query
     * @param {string} query.name
     */
    async fetchDataSource({ name }) {
        const dataSource = await this.fetchDataSourceMetaData({ name });
        const files = await this.listWithStats({ name });
        return { ...dataSource, files };
    }


    /** @type {(query: {dataSourceId: string, fileName: string}) => Promise<string>} */
    async fetchFile({ dataSourceId, fileName }) {
        return storage.hkubeDataSource.getStream({ dataSource: dataSourceId, fileName });
    }

    /** @param {{name: string}} query */
    async delete({ name }) {
        const [deletedId] = await Promise.all([
            db.dataSources.delete({ name }),
            storage.hkubeDataSource.delete({ dataSource: name })
        ]);
        return deletedId;
    }

    async list() {
        return db.dataSources.fetchAll();
    }

    /** @param {{name: string}} query */
    async listWithStats({ name }) {
        return storage.hkubeDataSource.listWithStats({ dataSource: name });
    }
}

module.exports = new DataSource();
