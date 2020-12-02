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
     * @param {string} props.name
     * @param {string} props.versionDescription
     * @param {Express.Multer.File[]} props.filesAdded
     * @param {string[]} props.filesDropped
     */
    async updateDataSource({ name, filesAdded, filesDropped, versionDescription }) {
        validator.dataSource.validateUploadFile({ filesAdded, versionDescription, filesDropped });
        const createdVersion = await db.dataSources.updateVersion({ name, versionDescription });
        let updatedDataSource;
        try {
            const filesAddedMeta = await this.uploadFiles({
                dataSourceName: name,
                files: filesAdded
            });
            updatedDataSource = await db.dataSources.uploadFiles({
                name,
                filesAdded: filesAddedMeta,
                filesDropped
            });
        }
        catch (error) {
            await Promise.allSettled([
                db.dataSources.delete({ id: createdVersion.id }),
                storage.hkubeDataSource.deleteFiles(filesAdded)
            ]);
            throw error;
        }
        return updatedDataSource;
    }

    /**
      * @param {object} query
      * @param {string} query.dataSourceName
      * @param {Express.Multer.File[]} query.files
      */
    async uploadFiles({ dataSourceName, files }) {
        const createdPaths = await Promise.all(
            files.map(file => storage.hkubeDataSource.putStream({
                dataSource: dataSourceName,
                data: fse.createReadStream(file.path),
                fileName: file.originalname,
            }))
        );
        return files.map((file, ii) => ({ name: file.originalname, size: file.size, path: createdPaths[ii].path, type: file.mimetype }));
    }

    /**
      * @param {object} query
      * @param {string} query.name
      * @param {Express.Multer.File[]} query.files
      */
    async createDataSource({ name, files }) {
        validator.dataSource.validateCreate({ name, files });
        let filesMeta;
        try {
            await db.dataSources.create({ name });
        }
        catch (error) {
            if (error.type === errorTypes.CONFLICT) {
                throw new ResourceExistsError('dataSource', name);
            }
        }
        let updatedDataSource;
        try {
            filesMeta = await this.uploadFiles({ dataSourceName: name, files });
            updatedDataSource = await db.dataSources.uploadFiles({ name, filesAdded: filesMeta });
        }
        catch (error) {
            await Promise.allSettled([
                db.dataSources.delete({ name }),
                storage.hkubeDataSource.deleteFiles(filesMeta)
            ]);
            throw error;
        }
        return updatedDataSource;
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

    /** @type {(query: {names?: string[], ids?:string[]}) => Promise<DataSourceItem[]>} */
    async fetchDataSources({ names, ids }) {
        return db.dataSources.fetchMany({ names, ids });
    }

    /** @type {(query: {dataSourceName: string, fileName: string}) => Promise<string>} */
    async fetchFile({ dataSourceName, fileName }) {
        return storage.hkubeDataSource.getStream({ dataSource: dataSourceName, fileName });
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

