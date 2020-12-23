const { errorTypes, isDBError } = require('@hkube/db/lib/errors');
const fse = require('fs-extra');
const { default: simpleGit } = require('simple-git');
const childProcess = require('child_process');
const { parse: parsePath } = require('path');
const { ResourceExistsError, ResourceNotFoundError } = require('../errors');
const validator = require('../validation/api-validator');
const dvcConfig = require('../utils/dvc');
const dbConnection = require('../db');
const normalize = require('../utils/normalize');

const DATASOURCE_GIT_REPOS_DIR = 'temp/datasource-git-repositories';
/**
 * @typedef {import('@hkube/db/lib/DataSource').FileMeta} FileMeta
 * @typedef {import('@hkube/db/lib/DataSource').DataSource} DataSourceItem;
 * @typedef {import('express')} Express;
 * @typedef {{ createdPath: string; fileName: string }} uploadFileResponse
 * @typedef {{ name?: string; id?: string }} NameOrId
 * @typedef {{ [fileId: string]: FileMeta }} NormalizedFileMeta
 * @typedef {Express.Multer.File} MulterFile
 * @typedef {[FileMeta, FileMeta]} SourceTargetArray
 * @typedef {typeof import('./../../config/main/config.base')} config
 */

/** @type {(str: string, to: string) => string} */
const convertWhiteSpace = (str, to) => str.split(' ').join(to);

/**
 * @param {{ name: string; path: string }} File
 * @param { string= } dataDir
 */
const getFilePath = ({ name, path }, dataDir = 'data') =>
    path === '/'
        ? `${dataDir}/${name}`
        : // ensure there's no '/' at the end of a path
          `${dataDir}/${path.replace(/^\//, '')}/${name}`;

const metaRegex = new RegExp('.meta');
/** @param {string} fileName */
const isMetaFile = fileName => fileName.match(metaRegex);

const extractFileName = metaData => metaData.input.slice(0, metaData.index);

/** @type {import('@hkube/db/lib/MongoDB').ProviderInterface} */
let db = null;

class DataSource {
    constructor() {
        this.rootDir = DATASOURCE_GIT_REPOS_DIR;
        this.createRepo = this.createRepo.bind(this);
        fse.ensureDirSync(this.rootDir);
    }

    /** @param {config} config */
    async init(config) {
        this.config = config;
        const storage = config.defaultStorage;
        this.generateDvcConfig =
            storage === 'fs'
                ? dvcConfig.getFSConfig
                : dvcConfig.getS3Config({
                      endpoint: config.s3.endpoint,
                      bucketName: 'local-hkube-datasource',
                      secretAccessKey: config.s3.secretAccessKey,
                      accessKeyId: config.s3.accessKeyId,
                      useSSL: false,
                  });
        db = dbConnection.connection;
    }

    async _execute(repositoryName, command) {
        const [mainCmd, ...args] = command.split(' ');
        const cmd = childProcess.spawn(mainCmd, args, {
            cwd: `${this.rootDir}/${repositoryName}`,
        });
        return new Promise((res, rej) => {
            let cache = '';
            cmd.stdout.on('data', d => {
                cache += d.toString();
            });
            cmd.stderr.on('data', d => {
                cache += d.toString();
            });
            cmd.stdout.on('error', () => rej(cache));
            cmd.on('error', rej);
            cmd.on('close', errorCode =>
                errorCode !== 0 ? rej(cache) : res(cache)
            );
        });
    }

    /** @param {string} name */
    async setupDvcRepository(name) {
        await this._execute(name, 'dvc init');
        await fse.writeFile(
            `${this.rootDir}/${name}/.dvc/config`,
            this.generateDvcConfig(name)
        );
    }

    getRepositoryUrl(repositoryName) {
        const {
            endpoint,
            user: { name: userName, password },
        } = this.config.git;
        return `http://${userName}:${password}@${endpoint}/hkube/${repositoryName}.git`;
    }

    async createRepo(name) {
        await fse.ensureDir(`${this.rootDir}/${name}`);
        await fse.ensureDir(`${this.rootDir}/${name}/data`);
        const git = simpleGit({ baseDir: `${this.rootDir}/${name}` });
        await git.init().addRemote('origin', this.getRepositoryUrl(name));
        await this.setupDvcRepository(name);
        await git.add('.');
        const response = await git.commit('initialized');
        await git.push(['--set-upstream', 'origin', 'master']);
        return { ...response, commit: response.commit.replace(/(.+) /, '') };
    }

    /** @type {(file: MulterFile, path?: string) => FileMeta} */
    createFileMeta(file, path = null) {
        return {
            id: file.filename,
            name: file.originalname,
            path: path || '/',
            size: file.size,
            type: file.mimetype,
            description: '',
            uploadedAt: new Date().getTime(),
        };
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
                let fileMeta = this.createFileMeta(
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
     * @param {string} repositoryName
     * @param {string} baseDir
     * @param {string[]} fileIds
     * @param {FileMeta[]} currentFiles
     */
    async _dropFiles(repositoryName, baseDir, fileIds, currentFiles) {
        if (fileIds.length === 0) return;
        const normalizedCurrentFiles = normalize(currentFiles);
        await Promise.all(
            fileIds.map(async id => {
                const path = getFilePath(normalizedCurrentFiles[id]);
                if (!path) return null;
                // drops the dvc file and updates gitignore
                await this._execute(repositoryName, `dvc remove ${path}.dvc`);
                const fullPath = `${baseDir}/${path}`;
                if (await fse.pathExists(fullPath)) {
                    await fse.unlink(fullPath);
                }
                return null;
            })
        );
    }

    /**
     * Loads the .meta files and add their content to the description field on
     * the file normalized mapping return a new mapping object
     *
     * @param {NormalizedFileMeta} normalizedMapping
     * @param {{ [path: string]: string }} byPath
     * @param {{ [path: string]: MulterFile }} metaFilesByPath
     */
    async _loadMetaDataFile(normalizedMapping, byPath, metaFilesByPath) {
        const contents = await Promise.all(
            Object.entries(metaFilesByPath).map(async ([filePath, file]) => {
                const content = await fse.readFile(file.path);
                return [byPath[filePath], content.toString('utf8')];
            })
        );
        return contents.reduce(
            (acc, [fileId, description]) => ({
                ...acc,
                [fileId]: { ...acc[fileId], description },
            }),
            normalizedMapping
        );
    }

    /**
     * Splits the inputs to groups by their respective actions. **note**: the
     * normalizedAddedFiles collection includes all the added files including
     * updated file
     *
     * @param {{
     *   currentFiles?: FileMeta[];
     *   mapping: FileMeta[];
     *   addedFiles?: MulterFile[];
     * }=} props
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
    _splitToGroups({
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
                if (movedFile) {
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
     * @param {string} repositoryName
     * @param {string} baseDir
     * @param {NormalizedFileMeta} normalizedMapping
     * @param {MulterFile[]} allAddedFiles
     */
    async _addFiles(repositoryName, baseDir, normalizedMapping, allAddedFiles) {
        if (allAddedFiles.length === 0) return null;

        const { dirs, filePaths } = Object.values(normalizedMapping).reduce(
            (acc, fileMeta) => {
                const filePath = getFilePath(fileMeta);
                const dirPath = filePath.slice(
                    0,
                    filePath.length - fileMeta.name.length - 1
                );
                return {
                    dirs: acc.dirs.concat(dirPath),
                    filePaths: acc.filePaths.concat(filePath),
                };
            },
            { dirs: [], filePaths: [] }
        );

        const uniqueDirs = [...new Set(dirs)];

        await Promise.all(
            uniqueDirs.map(dir =>
                fse.ensureDir(`${this.rootDir}/${repositoryName}/${dir}`)
            )
        );

        await Promise.all(
            allAddedFiles.map(file => {
                const fileMeta = normalizedMapping[file.filename];
                return fse.move(
                    file.path,
                    `${baseDir}/${getFilePath(fileMeta)}`,
                    { overwrite: true }
                );
            })
        );
        // creates .dvc files and update/create the relevant gitignore files
        await this._execute(repositoryName, `dvc add ${filePaths.join(' ')}`);
        return null;
    }

    /**
     * @param {string} repositoryName
     * @param {SourceTargetArray[]} sourceTargetArray
     */
    async _moveExistingFiles(repositoryName, sourceTargetArray) {
        return Promise.all(
            sourceTargetArray.map(async ([srcFile, targetFile]) => {
                const srcPath = getFilePath(srcFile);
                const targetPath = getFilePath(targetFile);
                // moves .dvc files and updates gitignore
                return this._execute(
                    repositoryName,
                    `dvc move ${srcPath} ${targetPath}`
                );
            })
        );
    }

    /**
     * @param {{
     *     repositoryName: string;
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
        repositoryName,
        commitMessage,
        files: { added, dropped = [], mapping = [] },
        currentFiles = [],
    }) {
        const baseDir = `${this.rootDir}/${repositoryName}`;
        await fse.ensureDir(baseDir);
        const hasClone = await fse.pathExists(`${baseDir}/.git`);
        if (!hasClone) {
            await simpleGit({ baseDir: this.rootDir }).clone(
                this.getRepositoryUrl(repositoryName)
            );
        }
        const git = simpleGit({ baseDir });

        const groups = this._splitToGroups({
            currentFiles,
            mapping,
            addedFiles: added,
        });
        const normalizedAddedFiles = await this._loadMetaDataFile(
            groups.normalizedAddedFiles,
            groups.byPath,
            groups.metaFilesByPath
        );
        await this._addFiles(
            repositoryName,
            baseDir,
            normalizedAddedFiles,
            groups.allAddedFiles
        );
        await this._moveExistingFiles(repositoryName, groups.movedFiles);
        await this._dropFiles(repositoryName, baseDir, dropped, currentFiles);
        /**
         * Cleanups: - drop empty directories and empty git ignore files
         *     make sure the directory is really empty and has no subDirs!
         */

        await this._execute(repositoryName, 'dvc push -r storage');
        await git.add('.');
        const { commit } = await git.commit(commitMessage);
        await git.push();
        const finalMapping = Object.values(normalizedAddedFiles).concat(
            groups.movedFiles.map(([, targetFile]) => targetFile)
        );

        await fse.remove(baseDir);

        return {
            commitHash: commit,
            files: {
                droppedIds: groups.touchedFileIds.concat(dropped),
                mapping: finalMapping,
            },
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
    async updateDataSource({ name, files: _files, versionDescription }) {
        validator.dataSource.update({
            name,
            files: _files,
            versionDescription,
        });
        // add ajv validation here
        // also acts validates the datasource exists
        // can be used to tag the dataSource as locked while updating
        // add fetch dataSource a flag to take the lock into account
        const createdVersion = await db.dataSources.createVersion({
            versionDescription,
            name,
        });
        const { commitHash, files } = await this.commitChange({
            repositoryName: name,
            files: _files,
            commitMessage: versionDescription,
            currentFiles: createdVersion.files,
        });
        if (!commitHash) {
            await db.dataSources.delete({ id: createdVersion.id });
            return null;
        }
        return db.dataSources.uploadFiles({
            name,
            files,
            versionId: commitHash,
        });
    }

    /** @param {{ name: string; files: MulterFile[] }} query */
    async createDataSource({ name, files }) {
        validator.dataSource.create({ name, files });
        let createdDataSource;
        try {
            createdDataSource = await db.dataSources.create({ name });
        } catch (error) {
            if (error.type === errorTypes.CONFLICT) {
                throw new ResourceExistsError('dataSource', name);
            }
            return null;
        }
        await this.createRepo(name);
        const {
            commitHash,
            files: { mapping },
        } = await this.commitChange({
            repositoryName: name,
            commitMessage: 'initial upload',
            files: {
                added: files,
            },
        });
        let updatedDataSource;

        try {
            updatedDataSource = await db.dataSources.uploadFiles({
                id: createdDataSource.id,
                files: { mapping },
                versionId: commitHash,
            });
        } catch (error) {
            await Promise.allSettled([
                db.dataSources.delete({ name }), // delete from the git server and dvc storage
            ]);
            throw error;
        }
        return updatedDataSource;
    }

    /** @param {{ name?: string; id?: string }} query */
    async fetchDataSourceMetaData({ name, id }) {
        let dataSource = null;
        try {
            dataSource = await db.dataSources.fetch({ name, id });
        } catch (error) {
            if (isDBError(error) && error.type === errorTypes.NOT_FOUND) {
                throw new ResourceNotFoundError('dataSource', name, error);
            }
            throw error;
        }
        return dataSource;
    }

    /** @param {{ name?: string; id?: string }} query */
    async fetchDataSource({ name, id }) {
        return this.fetchDataSourceMetaData({ name, id });
    }

    /**
     * @type {(query: {
     *     names?: string[];
     *     ids?: string[];
     * }) => Promise<DataSourceItem[]>}
     */
    async fetchDataSources({ names, ids }) {
        return db.dataSources.fetchMany({ names, ids });
    }

    async list() {
        return db.dataSources.fetchAll();
    }

    /** @param {string} name */
    async listVersions(name) {
        return db.dataSources.listVersions({ name });
    }
}

module.exports = new DataSource();
