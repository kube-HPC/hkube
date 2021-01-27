const fse = require('fs-extra');
const Repository = require('../utils/Repository');
const validator = require('../validation');
const dbConnection = require('../db');
const normalize = require('../utils/normalize');
const { getFilePath } = require('../utils/filePath');
const { createFileMeta } = require('./../utils/createFileMeta');

/**
 * @typedef {import('./../utils/types').FileMeta} FileMeta
 * @typedef {import('./../utils/types').MulterFile} MulterFile
 * @typedef {import('./../utils/types').NormalizedFileMeta} NormalizedFileMeta
 * @typedef {import('./../utils/types').SourceTargetArray} SourceTargetArray
 * @typedef {import('./../utils/types').config} config
 * @typedef {import('@hkube/db/lib/DataSource').DataSource} DataSourceItem;
 * @typedef {{ createdPath: string; fileName: string }} uploadFileResponse
 * @typedef {{ name?: string; id?: string }} NameOrId
 */

/** @type {(str: string, to: string) => string} */
const convertWhiteSpace = (str, to) => str.split(' ').join(to);

const metaRegex = new RegExp('.meta');
/** @param {string} fileName */
const isMetaFile = fileName => fileName.match(metaRegex);

const extractFileName = metaData => metaData.input.slice(0, metaData.index);

class DataSource {
    /** @param {config} config */
    async init(config) {
        this.config = config;
        this.db = dbConnection.connection;
        await fse.ensureDir(this.config.directories.gitRepositories);
    }

    /**
     * Converts temporary ids given by the client to permanent ids. fills in
     * missing details for all the files
     *
     * @param {NormalizedFileMeta} normalizedMapping
     * @param {MulterFile[]} files
     * @returns {{
     *     allFiles: MulterFile[];
     *     normalizedAddedFiles: NormalizedFileMeta;
     *     byPath: { [path: string]: string }; // maps from path to fileId
     *     metaFilesByPath: { [path: string]: MulterFile };
     * }}
     */
    prepareAddedFiles(normalizedMapping, files) {
        return files.reduce(
            (acc, file) => {
                const tmpFileName = file.originalname;
                let fileMeta = createFileMeta(
                    file,
                    normalizedMapping[tmpFileName]?.path
                );
                const mappingEntry = normalizedMapping[tmpFileName];
                if (mappingEntry) {
                    fileMeta = {
                        ...fileMeta,
                        name: mappingEntry.name,
                    };
                }

                const filePath = getFilePath(fileMeta);
                const metaDescription = isMetaFile(fileMeta.name);
                if (metaDescription) {
                    const fileName = extractFileName(metaDescription);
                    const _path = getFilePath({
                        ...fileMeta,
                        name: fileName,
                    });
                    return { ...acc, metaFilesByPath: { [_path]: file } };
                }
                // the file does not have an id for a name - it is unmapped
                if (!mappingEntry) {
                    return {
                        ...acc,
                        byPath: {
                            ...acc.byPath,
                            [filePath]: file.filename,
                        },
                        allFiles: acc.allFiles.concat(file),
                        normalizedAddedFiles: {
                            ...acc.normalizedAddedFiles,
                            [file.filename]: fileMeta,
                        },
                    };
                }
                const {
                    // @ts-ignore
                    [tmpFileName]: droppedId,
                    ...nextMapping
                } = acc.normalizedAddedFiles;

                return {
                    ...acc,
                    byPath: {
                        ...acc.byPath,
                        [filePath]: file.filename,
                    },
                    // convert the file's name back from an id to it's actual name
                    allFiles: acc.allFiles.concat({
                        ...file,
                        originalname: fileMeta.name,
                    }),
                    // re-add the file with its final id
                    normalizedAddedFiles: {
                        ...nextMapping,
                        [file.filename]: fileMeta,
                    },
                };
            },
            {
                allFiles: [],
                normalizedAddedFiles: {},
                byPath: {},
                metaFilesByPath: {},
            }
        );
    }

    /**
     * Splits the inputs to groups by their respective actions. **note**: the
     * normalizedAddedFiles collection includes all the added files including
     * updated file
     *
     * @param {{
     *     currentFiles?: FileMeta[];
     *     mapping: FileMeta[];
     *     addedFiles?: MulterFile[];
     * }} props
     * @returns {{
     *     allAddedFiles: MulterFile[];
     *     normalizedAddedFiles: NormalizedFileMeta;
     *     byPath: { [path: string]: string };
     *     updatedFiles: SourceTargetArray[];
     *     movedFiles: SourceTargetArray[];
     *     touchedFileIds: string[];
     *     metaFilesByPath: { [path: string]: MulterFile };
     * }}
     */
    _categorizeFiles({
        currentFiles = [],
        mapping,
        addedFiles: _addedFiles = [],
    }) {
        /** @type {{ [fileID: string]: FileMeta }} */
        const normalizedMapping = normalize(mapping, 'id', file => ({
            ...file,
            path: convertWhiteSpace(file.path, '-'),
        }));
        const {
            allFiles: allAddedFiles, // mapped files were renamed from ids to their actual names
            normalizedAddedFiles,
            byPath,
            metaFilesByPath,
        } = this.prepareAddedFiles(normalizedMapping, _addedFiles);

        /**
         * @type {{
         *     movedFiles: SourceTargetArray[];
         *     updatedFiles: SourceTargetArray[];
         *     touchedFileIds: string[];
         * }}
         */
        const {
            movedFiles,
            updatedFiles,
            touchedFileIds,
        } = currentFiles.reduce(
            (acc, srcFile) => {
                const movedFile = normalizedMapping[srcFile.id];
                const updatedFileId = byPath[getFilePath(srcFile)];
                const updatedFile = normalizedAddedFiles[updatedFileId];
                if (updatedFile) {
                    return {
                        ...acc,
                        updatedFiles: [
                            ...acc.updatedFiles,
                            [srcFile, updatedFile],
                        ],
                        touchedFileIds: acc.touchedFileIds.concat(srcFile.id),
                    };
                }
                if (movedFile && srcFile.path !== movedFile.path) {
                    return {
                        ...acc,
                        movedFiles: [...acc.movedFiles, [srcFile, movedFile]],
                        touchedFileIds: acc.touchedFileIds.concat(srcFile.id),
                    };
                }
                return acc;
            },
            { movedFiles: [], updatedFiles: [], touchedFileIds: [] }
        );

        return {
            allAddedFiles,
            normalizedAddedFiles,
            byPath,
            movedFiles,
            updatedFiles,
            touchedFileIds,
            metaFilesByPath,
        };
    }

    /**
     * @param {{
     *     repository: Repository;
     *     commitMessage: string;
     *     files: {
     *         added: MulterFile[];
     *         mapping?: FileMeta[];
     *         dropped?: string[];
     *     };
     *     currentFiles?: FileMeta[];
     * }} props
     */
    async commitChange({
        repository,
        commitMessage,
        files: { added, dropped = [], mapping = [] },
        currentFiles = [],
    }) {
        await repository.ensureClone();
        const groups = this._categorizeFiles({
            currentFiles,
            mapping,
            addedFiles: added,
        });
        const { normalizedAddedFiles } = groups;
        const metaByPath = await repository.loadMetaDataFiles(
            groups.normalizedAddedFiles,
            groups.byPath,
            groups.metaFilesByPath
        );
        await repository.addFiles(
            normalizedAddedFiles,
            groups.allAddedFiles,
            metaByPath
        );
        await repository.moveExistingFiles(groups.movedFiles);
        await repository.dropFiles(dropped, currentFiles);
        /** Cleanups: - drop empty git ignore files */
        const commit = await repository.push(commitMessage);
        const finalMapping = await repository.scanDir();
        await repository.cleanup();
        return {
            commitHash: commit,
            files: finalMapping,
        };
    }

    /**
     * @param {{
     *     name: string;
     *     versionDescription: string;
     *     files: {
     *         mapping: FileMeta[];
     *         added: MulterFile[];
     *         dropped: string[];
     *     };
     * }} props
     */
    async update({ name, files: _files, versionDescription }) {
        validator.dataSources.update({
            name,
            files: _files,
            versionDescription,
        });
        // validates the datasource exists, adds a partial flag on the version
        const createdVersion = await this.db.dataSources.createVersion({
            versionDescription,
            name,
        });

        const repository = new Repository(
            name,
            this.config,
            this.config.directories.gitRepositories
        );

        const { commitHash, files } = await this.commitChange({
            repository,
            files: _files,
            commitMessage: versionDescription,
            currentFiles: createdVersion.files,
        });
        repository.deleteClone();
        if (!commitHash) {
            await this.db.dataSources.delete({ id: createdVersion.id });
            return null;
        }
        return this.db.dataSources.updateFiles({
            name,
            files,
            commitHash,
        });
    }

    /** @param {{ name: string; files: MulterFile[] }} query */
    async create({ name, files: _files }) {
        validator.dataSources.create({ name, files: _files });
        const createdDataSource = await this.db.dataSources.create({ name });
        let updatedDataSource;
        /** @type {Repository} */
        const repository = new Repository(
            name,
            this.config,
            this.config.directories.gitRepositories
        );
        try {
            await repository.setup();
            const { commitHash, files } = await this.commitChange({
                repository,
                commitMessage: 'initial upload',
                files: { added: _files },
            });

            updatedDataSource = await this.db.dataSources.updateFiles({
                id: createdDataSource.id,
                files,
                commitHash,
            });
        } catch (error) {
            await this.db.dataSources.delete({ name });
            throw error;
        } finally {
            await repository.deleteClone();
        }
        return updatedDataSource;
    }

    /** @param {{ name?: string; id?: string }} query */
    fetch({ name, id }) {
        return this.db.dataSources.fetch({
            name,
            id,
            isPartial: false,
        });
    }

    async delete({ name }) {
        validator.dataSources.delete({ name });
        const response = await this.db.dataSources.delete(
            { name },
            { allowNotFound: false }
        );
        return response;
    }

    /**
     * @type {(query: {
     *     names?: string[];
     *     ids?: string[];
     * }) => Promise<DataSourceItem[]>}
     */
    async fetchDataSources({ names, ids }) {
        return this.db.dataSources.fetchMany({ names, ids });
    }

    // eslint-disable-next-line
    async sync({ name }) {
        // validator.dataSources.sync({ name });
        // pull the repo
        // list all the files and match dvc file and meta file
        // ensure the .dvc file has the required content and append the meta content
        // ISSUE:
        // there will be missing file info - it can be fetched from the storage or fetch the file
        // * consider, moving this behavior to the front-end
    }

    async list() {
        return this.db.dataSources.listDataSources();
    }

    /** @param {string} name */
    async listVersions(name) {
        return this.db.dataSources.listVersions({ name });
    }
}

module.exports = new DataSource();
