const { errorTypes, isDBError } = require('@hkube/db/lib/errors');
const fse = require('fs-extra');
const { default: simpleGit } = require('simple-git');
const childProcess = require('child_process');
const { parse: parsePath } = require('path');
const { connection: db } = require('../db');
const { ResourceExistsError, ResourceNotFoundError } = require('../errors');
const validator = require('../validation/api-validator');

const DATASOURCE_GIT_REPOS_DIR = 'temp/datasource-git-repositories';
/**
 *  @typedef {import('@hkube/db/lib/DataSource').FileMeta} FileMeta
 *  @typedef {import('@hkube/db/lib/DataSource').DataSource} DataSourceItem;
 *  @typedef {import('express')} Express;
 *  @typedef {{createdPath: string, fileName: string}} uploadFileResponse
 *  @typedef {import('@hkube/storage-manager/lib/storage/storage-base').EntryWithMetaData} EntryWithMetaData
 *  @typedef {{name?: string; id?: string;}} NameOrId
 *  @typedef {{[fileId: string]: FileMeta}} NormalizedFileMeta
 *  @typedef {[FileMeta, FileMeta]} SourceTargetArray
 * */

/**
 * @param {object[]} collection
 * @param {string=} id
 * @param {function=} mapper
 * */
const normalize = (collection, id = 'id', mapper) => collection
    .reduce((acc, item) => ({
        ...acc,
        [item[id]]: mapper ? mapper(item) : item
    }), {});

const convertWhiteSpace = (str, to) => str.split(' ').join(to);

/**
 * @param {{name: string, path: string}} File
 * @param {string=} dataDir
 * */
const getFilePath = ({ name, path }, dataDir = 'data') => (
    path === '/'
        ? `${dataDir}/${name}`
        // ensure there's no '/' at the end of a path
        : `${dataDir}/${path.replace(/^\//, '')}/${name}`
);

class DataSource {
    constructor() {
        this.rootDir = DATASOURCE_GIT_REPOS_DIR;
        this.createRepo = this.createRepo.bind(this);
        fse.ensureDirSync(this.rootDir);
    }

    /** @param {string} name */
    async setupDvcRepository(name) {
        await this._execute(name, 'dvc init');
        // update dvc config file - add remote and bucket name
    }

    async createRepo(name) {
        await fse.ensureDir(`${this.rootDir}/${name}`);
        await fse.ensureDir(`${this.rootDir}/${name}/data`);
        const git = simpleGit({ baseDir: `${this.rootDir}/${name}` });
        await git.init();
        await this.setupDvcRepository(name);
        await git.add('.');
        const response = await git.commit('initialized');
        // git.addRemote()
        // git.push()
        return { ...response, commit: response.commit.replace(/(.+) /, '') };
    }

    async _execute(repositoryName, command) {
        const ls = await childProcess.exec(command, { cwd: `${this.rootDir}/${repositoryName}` });
        let cache = '';
        ls.stdout.on('data', data => {
            cache += data;
        });
        await new Promise((res, rej) => {
            ls.on('error', rej);
            ls.stdout.on('end', (data) => {
                res(data);
            });
        });
        return cache;
    }

    /** @type {(file: Express.Multer.File, path?:string) => FileMeta} */
    createFileMeta(file, path = null) {
        return {
            id: file.filename,
            name: file.originalname,
            path: path || '/',
            size: file.size,
            type: file.mimetype,
            description: '',
            uploadedAt: new Date().getTime()
        };
    }

    /**
     * converts temporary ids given by the client to permanent ids.
     * fills in missing details for all the files
     * @param {NormalizedFileMeta} normalizedMapping
     * @param {Express.Multer.File[]} files
     * @returns {{
     *  allFiles: Express.Multer.File[];
     *  normalizedAddedFiles: NormalizedFileMeta;
     *  byPath: {[path: string]: string} // maps from path to fileId
     * }}
     */
    prepareAddedFiles(normalizedMapping, files) {
        return files.reduce((acc, file) => {
            const tmpFileName = file.originalname;
            const fileMeta = this.createFileMeta(file, normalizedMapping[tmpFileName]?.path);
            const filePath = getFilePath(fileMeta);
            // the file does not have an id for a name - it is unmapped
            if (!normalizedMapping[tmpFileName]) {
                return {
                    ...acc,
                    byPath: {
                        ...acc.byPath,
                        [filePath]: file.filename
                    },
                    allFiles: acc.allFiles.concat(file),
                    normalizedAddedFiles: {
                        ...acc.normalizedAddedFiles,
                        [file.filename]: fileMeta
                    },
                };
            }
            // @ts-ignore
            const { [tmpFileName]: droppedId, ...nextMapping } = acc.normalizedAddedFiles;
            const updatedFileMeta = {
                ...fileMeta,
                name: normalizedMapping[tmpFileName].name
            };
            return {
                ...acc,
                byPath: {
                    ...acc.byPath,
                    [filePath]: file.filename
                },
                // convert the file's name back from an id to it's actual name
                allFiles: acc.allFiles.concat({
                    ...file,
                    originalname: updatedFileMeta.name
                }),
                // re-add the file with its final id
                normalizedAddedFiles: {
                    ...nextMapping,
                    [file.filename]: updatedFileMeta
                }
            };
        }, {
            allFiles: [],
            normalizedAddedFiles: {},
            byPath: {},
        });
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
        await Promise.all(fileIds.map(async id => {
            const path = getFilePath(normalizedCurrentFiles[id]);
            if (!path) return null;
            // drops the dvc file and updates gitignore
            await this._execute(repositoryName, `dvc remove ${path}.dvc`);
            const fullPath = `${baseDir}/${path}`;
            if (await fse.pathExists(fullPath)) {
                await fse.unlink(fullPath);
            }
            return null;
        }));
    }

    /**
     * splits the inputs to groups by their respective actions.
     * **note**: the normalizedAddedFiles collection includes all
     * the added files including updated file
     * @type { (props?: {
     *  currentFiles?: FileMeta[];
     *  mapping: FileMeta[];
     *  addedFiles?: Express.Multer.File[];
     *  }) => {
     *    mapping: FileMeta[];
     *    allAddedFiles: Express.Multer.File[];
     *    normalizedAddedFiles: NormalizedFileMeta
     *    byPath: {[path: string]: string}
     *    updatedFiles: SourceTargetArray[];
     *    movedFiles: SourceTargetArray[];
     *    touchedFileIds: string[];
     * }}
     * */
    _splitToGroups({ currentFiles = [], mapping, addedFiles: _addedFiles = [] }) {
        /** @type {{[fileID: string]: FileMeta}} */
        const normalizedMapping = normalize(mapping, 'id', file => ({
            ...file,
            path: convertWhiteSpace(file.path, '-')
        }));
        const {
            allFiles: allAddedFiles, // mapped files were renamed from ids to their actual names
            normalizedAddedFiles,
            byPath,
        } = this.prepareAddedFiles(normalizedMapping, _addedFiles);

        /** @type {{ movedFiles: SourceTargetArray[], updatedFiles: SourceTargetArray[], touchedFileIds: string[] }} */
        const { movedFiles, updatedFiles, touchedFileIds } = currentFiles.reduce((acc, srcFile) => {
            const movedFile = normalizedMapping[srcFile.id];
            const updatedFileId = byPath[getFilePath(srcFile)];
            const updatedFile = normalizedAddedFiles[updatedFileId];
            if (updatedFile) {
                return {
                    ...acc,
                    updatedFiles: [...acc.updatedFiles, [srcFile, updatedFile]],
                    touchedFileIds: acc.touchedFileIds.concat(srcFile.id)
                };
            }
            if (movedFile) {
                return {
                    ...acc,
                    movedFiles: [...acc.movedFiles, [srcFile, movedFile]],
                    touchedFileIds: acc.touchedFileIds.concat(srcFile.id)
                };
            }
            return acc;
        }, { movedFiles: [], updatedFiles: [], touchedFileIds: [] });

        const finalMapping = Object.values(normalizedAddedFiles)
            .concat(movedFiles.map(([, targetFile]) => targetFile));

        return {
            mapping: finalMapping,
            allAddedFiles,
            normalizedAddedFiles,
            byPath,
            movedFiles,
            updatedFiles,
            touchedFileIds
        };
    }

    /**
     * @param {string} repositoryName
     * @param {string} baseDir
     * @param {NormalizedFileMeta} normalizedMapping
     * @param {Express.Multer.File[]} allAddedFiles
     * */
    async _addFiles(repositoryName, baseDir, normalizedMapping, allAddedFiles) {
        if (allAddedFiles.length === 0) return null;

        const { dirs, filePaths } = Object.values(normalizedMapping).reduce((acc, fileMeta) => {
            const filePath = getFilePath(fileMeta);
            const dirPath = filePath.slice(0, filePath.length - fileMeta.name.length - 1);
            return {
                dirs: acc.dirs.concat(dirPath),
                filePaths: acc.filePaths.concat(filePath)
            };
        }, { dirs: [], filePaths: [] });

        const uniqueDirs = [...new Set(dirs)];

        await Promise.all(
            uniqueDirs.map(dir => fse.ensureDir(dir))
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
        await this._execute(
            repositoryName,
            `dvc add ${filePaths.join(' ')}`
        );
        return null;
    }

    /**
     * @param {string} repositoryName
     * @param {SourceTargetArray[]} sourceTargetArray
     * */
    async _moveExistingFiles(repositoryName, sourceTargetArray) {
        return Promise.all(sourceTargetArray.map(async ([srcFile, targetFile]) => {
            const srcPath = getFilePath(srcFile);
            const targetPath = getFilePath(targetFile);
            await fse.ensureDir(parsePath(targetPath).dir);
            // moves .dvc files and updates gitignore
            return this._execute(repositoryName, `dvc move ${srcPath} ${targetPath}`);
        }));
    }

    /**
     * @param {object} props
     * @param {string} props.repositoryName
     * @param {string} props.commitMessage
     * @param {object} props.files
     * @param {Express.Multer.File[]} props.files.added
     * @param {FileMeta[]=} props.files.mapping
     * @param {string[]=} props.files.dropped
     * @param {FileMeta[]=} props.currentFiles
     * */
    async commitChange({
        repositoryName,
        commitMessage,
        files: { added, dropped = [], mapping = [] },
        currentFiles = []
    }) {
        const baseDir = `${this.rootDir}/${repositoryName}`;
        /**
        * assume the repo has no remote, do not pull or push
        * it is assumed to be always there and always up to date
        * get the repo path and name from the db
        * git dir exists ? git pull : clone
        * future: clear the git directory it is not needed anymore
        */
        const git = simpleGit({ baseDir });
        const groups = this._splitToGroups({ currentFiles, mapping, addedFiles: added });
        await this._addFiles(repositoryName, baseDir, groups.normalizedAddedFiles, groups.allAddedFiles);
        await this._moveExistingFiles(repositoryName, groups.movedFiles);
        await this._dropFiles(repositoryName, baseDir, dropped, currentFiles);
        /**
        * cleanups:
        *   - drop empty directories and empty git ignore files
        *     make sure the directory is really empty and has no subDirs!
        * update dvc:
        *      dvc push
        */
        // await this._execute(repositoryName, `dvc push`);
        git.add('.');
        const { commit } = await git.commit(commitMessage);
        // await git.push()
        return {
            commitHash: commit,
            files: {
                droppedIds: groups.touchedFileIds.concat(dropped),
                mapping: groups.mapping
            }
        };
    }

    /**
     * @param {object} props
     * @param {string} props.name
     * @param {string} props.versionDescription
     * @param {object} props.files
     * @param {FileMeta[]} props.files.mapping
     * @param {Express.Multer.File[]} props.files.added
     * @param {string[]} props.files.dropped
     */
    async updateDataSource({ name, files: _files, versionDescription }) {
        // add ajv validation here
        // also acts validates the datasource exists
        // can be used to tag the dataSource as locked while updating
        // add fetch dataSource a flag to take the lock into account
        const currentVersion = await db.dataSources.createVersion({
            versionDescription,
            name
        });
        const { commitHash, files } = await this.commitChange({
            repositoryName: name,
            files: _files,
            commitMessage: versionDescription,
            currentFiles: currentVersion.files
        });
        if (!commitHash) return null;
        // release the lock
        return db.dataSources.uploadFiles({
            name,
            files,
            versionId: commitHash,
        });
    }

    /**
      * @param {object} query
      * @param {string} query.name
      * @param {Express.Multer.File[]} query.files
      */
    async createDataSource({ name, files }) {
        validator.dataSource.validateCreate({ name, files });
        let createdDataSource;
        try {
            createdDataSource = await db.dataSources.create({ name });
        }
        catch (error) {
            if (error.type === errorTypes.CONFLICT) {
                throw new ResourceExistsError('dataSource', name);
            }
            return null;
        }
        await this.createRepo(name);
        const { commitHash, files: { mapping } } = await this.commitChange({
            repositoryName: name,
            commitMessage: 'initial upload',
            files: {
                added: files
            }
        });
        let updatedDataSource;

        try {
            updatedDataSource = await db.dataSources.uploadFiles({
                id: createdDataSource.id,
                files: { mapping },
                versionId: commitHash
            });
        }
        catch (error) {
            await Promise.allSettled([
                db.dataSources.delete({ name }) // delete from the git server and dvc storage
            ]);
            throw error;
        }
        return updatedDataSource;
    }

    /**
     * @param {object} query
     * @param {string=} query.name
     * @param {string=} query.id
     */
    async fetchDataSourceMetaData({ name, id }) {
        let dataSource = null;
        try {
            dataSource = await db.dataSources.fetch({ name, id });
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
     * @param {string=} query.name
     * @param {string=} query.id
     */
    async fetchDataSource({ name, id }) {
        return this.fetchDataSourceMetaData({ name, id });
    }

    /** @type {(query: {names?: string[], ids?:string[]}) => Promise<DataSourceItem[]>} */
    async fetchDataSources({ names, ids }) {
        return db.dataSources.fetchMany({ names, ids });
    }

    async list() {
        return db.dataSources.fetchAll();
    }
}

module.exports = new DataSource();
