const { uid } = require('@hkube/uid');
const pathLib = require('path');
const fse = require('fs-extra');
const archiver = require('archiver');
const {
    filePath: { getFilePath },
} = require('@hkube/datasource-utils');
const dbConnection = require('../db');
const Repository = require('../utils/Repository');
const validator = require('../validation');

/**
 * @typedef {import('../utils/types').config} config
 * @typedef {import('@hkube/db/lib/DataSource').FileMeta} FileMeta
 */

class Downloads {
    /** @param {config} config */
    async init(config) {
        this.config = config;
        this.db = dbConnection.connection;
        fse.ensureDirSync(this.config.directories.prepareForDownload);
        fse.ensureDirSync(this.config.directories.zipFiles);
    }

    get zipDir() {
        return this.config.directories.zipFiles;
    }

    createZip(rootDir, downloadId) {
        return new Promise((res, rej) => {
            const archive = archiver('zip', { zlib: { level: 9 } });
            archive.directory(rootDir, false);
            archive.finalize();
            const output = fse.createWriteStream(this.getZipPath(downloadId));
            archive.pipe(output);
            output.on('close', () => res(archive.pointer()));
            output.on('end', () => {
                console.info('Data has been drained');
            });
            archive.on('warning', err => {
                if (err.code === 'ENOENT') {
                    console.warn(err);
                } else {
                    rej(err);
                }
            });
            archive.on('error', rej);
        });
    }

    /**
     * @type {(props: {
     *     dataSourceId: string;
     *     fileIds: string[];
     * }) => Promise<string>} }
     */
    async prepareForDownload({ dataSourceId, fileIds }) {
        validator.downloads.validatePrepareForDownload({
            dataSourceId,
            fileIds,
        });
        const downloadId = uid();
        const dataSource = await this.db.dataSources.fetchWithCredentials({
            id: dataSourceId,
        });
        const fileIdsSet = new Set(fileIds);
        // create a new directory with the downloadId as its name
        const repository = new Repository(
            dataSource.name,
            this.config,
            pathLib.join(
                this.config.directories.prepareForDownload,
                downloadId
            ),
            dataSource.repositoryUrl,
            dataSource._credentials
        );

        /** @type {{ filesToKeep: FileMeta[]; filesToDrop: FileMeta[] }} */
        const { filesToKeep, filesToDrop } = dataSource.files.reduce(
            (acc, file) =>
                fileIdsSet.has(file.id)
                    ? { ...acc, filesToKeep: acc.filesToKeep.concat(file) }
                    : { ...acc, filesToDrop: acc.filesToDrop.concat(file) },
            {
                filesToKeep: [],
                filesToDrop: [],
            }
        );

        await repository.ensureClone();
        const filesPaths = filesToKeep.map(f => getFilePath(f));
        await repository.pullFiles(filesPaths);

        await repository.filterFilesFromClone(filesToDrop);
        await repository.dropNonDataFiles();
        await this.createZip(`${repository.cwd}/data`, downloadId);
        await fse.remove(repository.cwd);
        return downloadId;
    }

    getZipPath(downloadId) {
        validator.downloads.validateDownloadId(downloadId);
        return pathLib.join(
            this.config.directories.zipFiles,
            `${downloadId}.zip`
        );
    }
}

module.exports = new Downloads();
