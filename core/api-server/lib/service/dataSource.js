const storage = require('@hkube/storage-manager');
const { errorTypes, isDBError } = require('@hkube/db/lib/errors');
const fse = require('fs-extra');
const { default: simpleGit } = require('simple-git');
const childProcess = require('child_process');
const { parse: parsePath } = require('path');
const { connection: db } = require('../db');
const { NotModified } = require('../errors');
const {
    ResourceExistsError,
    ResourceNotFoundError
} = require('../errors');
const validator = require('../validation/api-validator');

const DATASOURCE_GIT_REPOS_DIR = 'temp/datasource-git-repositories';
/** @typedef {import('@hkube/db/lib/DataSource').FileMeta} FileMeta */

/**
 *  @typedef {import('@hkube/db/lib/DataSource').DataSource} DataSourceItem;
 *  @typedef {import('express')} Express;
 *  @typedef {{createdPath: string, fileName: string}} uploadFileResponse
 *  @typedef {import('@hkube/storage-manager/lib/storage/storage-base').EntryWithMetaData} EntryWithMetaData
 *  @typedef {{name?: string; id?: string;}} NameOrId
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

/** @type {(to: string) => (file: {path: string}) => { path: string } } */
const convertWhiteSpace = (to) => file => ({
    ...file,
    path: file.path.split(' ').join(to)
});

/**
 * @param {{name: string, path: string}} File
 * @param {string=} dataDir
 * */
const getFilePath = ({ name, path }, dataDir = 'data') => {
    return path === '/'
        ? `${dataDir}/${name}`
        : `${dataDir}/${path.replace(/^\//, '')}/${name}`;
};

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
        return response;
    }

    async _execute(repositoryName, command) {
        const ls = await childProcess.exec(command, { cwd: `${this.rootDir}/${repositoryName}` });
        let cache = '';
        ls.stdout.on('data', data => {
            cache += data;
        });
        await new Promise((res, rej) => {
            ls.on('error', rej);
            ls.stdout.on('end', res);
        });
        return cache;
    }

    /**
     * converts temporary ids given by the client to permanent ids
     * @param {{[fileID: string]: FileMeta}} normalizedMapping
     * @param {Express.Multer.File[]} files
     * @returns {{
     *  files: Express.Multer.File[];
     *  mapping: {[fileID: string]: FileMeta};
     * }}
     */
    _syncFilesMapping(normalizedMapping, files) {
        return files.reduce((acc, file) => {
            const tmpFileName = file.originalname;
            // the file has an id for a name
            if (!normalizedMapping[tmpFileName]) {
                return {
                    ...acc,
                    files: acc.files.concat(file),
                };
            }
            // drop the temporary id from the mapping
            const { [tmpFileName]: droppedId, ...nextMapping } = acc.mapping;
            return {
                ...acc,
                files: acc.files.concat({
                    ...file,
                    // the original name in this case is an id ur needs
                    // to be converted to the actual file name from the mapping
                    originalname: normalizedMapping[tmpFileName].name
                }),
                mapping: {
                    ...nextMapping,
                    // re-add the file to the mapping with its final id
                    [file.filename]: {
                        ...normalizedMapping[tmpFileName],
                        id: file.filename,
                    }
                }
            };
        }, { files: [], mapping: normalizedMapping });
    }

    /**
     * @param {string} repositoryName
     * @param {FileMeta[]} mapping
     * @param {{[fileID: string]: FileMeta}} normalizedCurrentFiles
     */
    async moveFiles(repositoryName, mapping, normalizedCurrentFiles) {
        if (mapping.length === 0) return {};
        // fill in missing details from the previous version of the file
        const filesMovedMapping = mapping.reduce((acc, file) => ({
            ...acc,
            [file.id]: {
                ...normalizedCurrentFiles[file.id],
                ...file
            }
        }), {});

        await Promise.all(mapping.map(async file => {
            const src = getFilePath(file);
            const target = getFilePath(filesMovedMapping[file.id]);
            await fse.ensureDir(parsePath(target).dir);
            // moves .dvc files and updates gitignore
            return this._execute(repositoryName, `dvc move ${src} ${target}`);
        }));
        return filesMovedMapping;
    }

    /**
    * @param {string} repositoryName
    * @param {string[]} fileIds
    * @param {{[fileID: string]: FileMeta}} normalizedCurrentFiles
    */
    async dropFiles(repositoryName, fileIds, normalizedCurrentFiles) {
        // ---- delete dropped files ---- //
        if (fileIds.length === 0) return;
        await Promise.all(fileIds.map(async id => {
            const path = getFilePath(normalizedCurrentFiles[id]);
            // drops the dvc file and updates gitignore
            return this._execute(repositoryName, `dvc remove ${path}.dvc`);
        }));
    }

    /**
     * @param {string} repositoryName
     * @param {string} dataDir
     * @param {FileMeta[]} mapping
     * @param {Express.Multer.File[]} added
     * */
    async addFiles(repositoryName, dataDir, mapping, added) {
        if (added.length === 0) {
            return {
                filesMap: mapping,
                normalizedFilesAdded: {},
                droppedIds: []
            };
        }

        const normalizedMapping = normalize(mapping, 'id', convertWhiteSpace('-'));

        // some files in the files added list are renamed
        // to an id (they should appear in the mapping with that same id)
        // some are not - they should be in the mapping list
        // rename and re-set all the ids to match on both the mapping and the files list
        const { files, mapping: _mapping } = this._syncFilesMapping(normalizedMapping, added);

        /** @type {{[filePath: string] : FileMeta}} */
        const normalizedByPath = Object.values(_mapping).reduce((acc, file) => ({
            ...acc,
            [getFilePath(file)]: file
        }), {});

        /**
         * run through all the files normalized byId, and path(in case of a file update)
         * fill in missing properties
         * drop files in duplicated location in favor of the newer one
         * lists old versions of files to drop
         * @type {{
         *  byId: {[fileId: string]: FileMeta}
         *  byPath: {[filePath: string]: FileMeta}
         *  droppedIds: string[]
         * }}
         * */
        const filesAddedMapping = files.reduce((acc, { filename: id, ...file }) => {
            /** @type {FileMeta} */
            const fileMeta = {
                id,
                name: file.originalname,
                path: _mapping[id]?.path ?? '/',
                size: file.size,
                type: file.mimetype,
                description: '',
                uploadedAt: new Date().getTime()
            };
            const filePath = getFilePath(fileMeta);

            let idToDrop;
            let nextByIdFile = fileMeta;
            if (acc.byPath[filePath]) {
                const existingFile = acc.byPath[filePath];
                if (existingFile.uploadedAt > fileMeta.uploadedAt) {
                    // byPath should hold only the latest for each path
                    nextByIdFile = existingFile;
                }
                if (existingFile.uploadedAt < fileMeta.uploadedAt) {
                    idToDrop = existingFile.id;
                }
            }
            return {
                byPath: {
                    ...acc.byPath,
                    [filePath]: nextByIdFile
                },
                droppedIds: idToDrop
                    ? acc.droppedIds.concat(idToDrop)
                    : acc.droppedIds,
                byId: {
                    ...acc.byId,
                    [id]: fileMeta
                }
            };
        }, { byId: _mapping, byPath: normalizedByPath, droppedIds: [] });

        const filesMap = Object.values(filesAddedMapping.byId);
        /** @type {{[fileID: string]: Express.Multer.File}} */
        const normalizedFilesAdded = normalize(added, 'filename');

        const addedFilesMap = filesMap
            .filter(file => normalizedFilesAdded[file.id] !== undefined);

        const pathNameRegex = /(.*\/)/;
        await Promise.all(
            addedFilesMap.map(file => fse.ensureDir(file.path.match(pathNameRegex)[0]))
        );

        // console.log({ addedFilesMap, normalizedFilesAdded, filesMap });
        await Promise.all(
            addedFilesMap.map(file => fse.move(
                normalizedFilesAdded[file.id].path,
                `${dataDir}/${file.path}/${file.name}`, { overwrite: true }
            ))
        );

        // creates .dvc files and update/create the relevant gitignore files
        await this._execute(
            repositoryName,
            `dvc add ${addedFilesMap.map(file => getFilePath(file)).join(' ')}`
        );

        return {
            filesMap: Object.values(filesAddedMapping.byPath),
            addedIds: Object.keys(normalizedFilesAdded),
            droppedIds: filesAddedMapping.droppedIds
        };
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
        files: {
            added,
            dropped = [],
            mapping = []
        },
        currentFiles = []
    }) {
        const baseDir = `${this.rootDir}/${repositoryName}`;
        const dataDir = `${baseDir}/data`;
        /**
        * assume the repo has no remote, do not pull or push
        * it is assumed to be always there and always up to date
        */
        const git = simpleGit({ baseDir });
        const normalizedCurrentFiles = currentFiles.reduce((acc, file, ii) => ({
            byId: {

                ...acc.byId,
                [file.id]: file,
            },
            byPath: {
                ...acc.byPath,
                [getFilePath(file, '')]: { ...file, idx: ii }
            }
        }), { byId: {}, byPath: {} });

        const { filesMap, addedIds, droppedIds } = await this.addFiles(
            repositoryName,
            dataDir,
            mapping,
            added
        );

        const addedIdsSet = new Set(addedIds);

        await this.moveFiles(
            repositoryName,
            added.length > 0
                // drop new files from the filesMap
                ? filesMap.filter(file => !addedIdsSet.has[file.id])
                : filesMap,
            normalizedCurrentFiles.byId
        );

        await this.dropFiles(repositoryName, dropped, normalizedCurrentFiles.byId);

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
                droppedIds: dropped.concat(droppedIds),
                mapping: filesMap
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
        const createdVersion = await db.dataSources.createVersion({
            name, versionDescription
        });

        const { commitHash, files } = await this.commitChange({
            repositoryName: name,
            files: _files,
            commitMessage: versionDescription,
            currentFiles: createdVersion.files
        });

        if (!commitHash) {
            await db.dataSources.delete({ id: createdVersion.id });
            return null;
        }

        // release the lock
        return db.dataSources.uploadFiles({
            name,
            files,
            versionId: commitHash
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
                db.dataSources.delete({ name }),
                // storage.hkubeDataSource.deleteFiles(filesMeta)
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
        return this.fetchDataSourceMetaData({ name });
    }

    /** @type {(query: {names?: string[], ids?:string[]}) => Promise<DataSourceItem[]>} */
    async fetchDataSources({ names, ids }) {
        return db.dataSources.fetchMany({ names, ids });
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

// -------------  trash  ------------- //
// /** @type {(query: {dataSourceName: string, fileName: string}) => Promise<string>} */
// async fetchFile({ dataSourceName, fileName }) {
//     return storage.hkubeDataSource.getStream({ dataSource: dataSourceName, fileName });
// }

// /** @param {{name: string}} query */
// async delete({ name }) {
//     // const [deletedId] = await Promise.all([
//     //     db.dataSources.delete({ name }),
//     //     storage.hkubeDataSource.delete({ dataSource: name })
//     // ]);
//     // return deletedId;
// }

// updateDataSource
// const createdVersion = await db.dataSources.updateVersion({ name, versionDescription });
// let updatedDataSource;
// try {
//     const filesAddedMeta = await this.uploadFiles({
//         dataSourceName: name,
//         files: filesAdded
//     });
//     updatedDataSource = await db.dataSources.uploadFiles({
//         name,
//         filesAdded: filesAddedMeta,
//         filesDropped
//     });
// }
// catch (error) {
//     await Promise.allSettled([
//         db.dataSources.delete({ id: createdVersion.id }),
//         storage.hkubeDataSource.deleteFiles(filesAdded)
//     ]);
//     throw error;
// }
// return updatedDataSource;
// }

// createGitRepo(name) {
// }

// /**
//   * @param {object} query
//   * @param {string} query.dataSourceName
//   * @param {Express.Multer.File[]} query.files
//   */
// async uploadFiles({ dataSourceName, files }) {
// const createdPaths = await Promise.all(
//     files.map(file => storage.hkubeDataSource.putStream({
//         dataSource: dataSourceName,
//         data: fse.createReadStream(file.path),
//         fileName: file.originalname,
//     }))
// );
// return files.map((file, ii) => ({ name: file.originalname, size: file.size, path: createdPaths[ii].path, type: file.mimetype }));

/**
 * * assume the repo has no remote, do not pull or push
 * it is assumed to be always there and always up to date
 * dvc workflow:
 * + constructor should create a git cached dir if not exists
 * get the repo path and name from the db
 * git dir exists?
 *      git pull
 * else:
 *      clone
 *
 * insert new files:
 *      - validate the subDirs needed
 *      - move the files from the multer tmp
 *        directory to their respective git repo in the relevant subDirs
 *        (defaults to the root/data dir)
 *      - clear tmp dir
 *      - run 'dvc add' on all the files
 * move and delete files:
 *      - prepare all the required subDirs (mandatory)
 *      - generate the source list
 *          - fetch the current files list
 *          - diff the current map from the existing one (this can be combined with the move to avoid multiple iterations)
 *      - use 'dvc move' to move the files(auto updates the gitignore):
 *      - use 'dvc remove' on the .dvc files to delete the files(auto updates the gitignore):
 *
 * cleanups:
 *      - drop empty directories and empty git ignore files
 *        make sure the directory is really empty and has no subDirs!
 *
 * update dvc:
 *      dvc push
 * update the git repo
 *      git commit - return the commit hash
 * list all the .dvc files with their respective paths
 * write the commit hash and the files list to the db
 *
 * future: clear the git directory it is not needed anymore
 */
