const storage = require('@hkube/storage-manager');
const { errorTypes, isDBError } = require('@hkube/db/lib/errors');
const fse = require('fs-extra');
const { default: simpleGit } = require('simple-git');
const childProcess = require('child_process');
const { connection: db } = require('../db');
const {
    ResourceExistsError,
    ResourceNotFoundError
} = require('../errors');
const validator = require('../validation/api-validator');
const { fileName } = require('../../tests/datasource.utils');

const DATASOURCE_GIT_REPOS_DIR = 'temp/datasource-git-repositories';
/** @typedef {import('@hkube/db/lib/DataSource').FileMeta} FileMeta */

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
 * */
const normalize = (collection, id = 'id') => collection.reduce((acc, item) => ({ ...acc, [item[id]]: item }), {});

class DataSource {
    constructor() {
        this.rootDir = DATASOURCE_GIT_REPOS_DIR;
        this.createRepo = this.createRepo.bind(this);
        fse.ensureDirSync(this.rootDir);
    }

    async createRepo(name) {
        await fse.ensureDir(`${this.rootDir}/${name}`);
        await fse.ensureDir(`${this.rootDir}/${name}/data`);
        const git = simpleGit({ baseDir: `${this.rootDir}/${name}` });
        // handle fail
        await git.init();
        await this._execute(name, 'dvc init');
        await git.add('.');
        const response = await git.commit('initialized');
        // add remote
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
     * @param {{[fileID: string]: FileMeta}} normalizedMapping
     * @param {Express.Multer.File[]} files
     * @returns {{
     *  files: Express.Multer.File[];
     *  mapping: {[fileID: string]: FileMeta};
     * }}
     */
    syncFilesMapping(normalizedMapping, files) {
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
     * @param {object} props
     * @param {string} props.repositoryName
     * @param {string} props.commitMessage
     * @param {object} props.files
     * @param {Express.Multer.File[]} props.files.added
     * @param {FileMeta[]=} props.files.mapping
     * @param {string[]=} props.files.dropped
     * */
    async commitChange({ repositoryName, commitMessage, files: { added, dropped = [], mapping: _mapping = [] } }) {
        const baseDir = `${this.rootDir}/${repositoryName}`;
        const dataDir = `${baseDir}/data`;

        // fileName is an id!!
        // originalName is the actual name
        const normalizedMapping = normalize(_mapping);

        // some files in the files added are mapped to an id
        // some are not
        // rename and re-set all the ids to match on
        // both the mapping and the files
        const normalizedFilesAdded = normalize(added, 'filename');
        const { files, mapping } = this.syncFilesMapping(normalizedMapping, added);

        // fill in the missing files to default to '/'
        const updatedMapping = files.reduce((acc, { filename: id, ...file }) => ({
            ...acc,
            [id]: {
                id,
                name: file.originalname,
                path: mapping[id]?.path ?? '/',
                size: file.size,
                type: file.mimetype,
                description: ''
            }
        }), mapping);
        /** @type {FileMeta[]} */
        const filesMap = Object.values(updatedMapping);
        /**
        * assume the repo has no remote, do not pull or push
        * it is assumed to be always there and always up to date
        */
        const git = simpleGit({ baseDir });

        const addedFilesMap = filesMap
            .filter(file => normalizedFilesAdded[file.id] !== undefined);

        // insert new files:
        // validate the subDirs needed
        const pathNameRegex = /(.*\/)/;
        await Promise.all(
            addedFilesMap.map(file => fse.ensureDir(file.path.match(pathNameRegex)[0]))
        );

        await Promise.all(
            addedFilesMap.map(file => fse.move(
                normalizedFilesAdded[file.id].path,
                `${dataDir}/${file.path}/${file.name}`
            ))
        );

        const filePaths = addedFilesMap.map(file => (
            file.path === '/'
                ? `data/${file.name}`
                : `data/${file.path.replace(/^\//, '')}/${file.name}`
        ));
        // creates .dvc files and update/create the relevant gitignore files
        await this._execute(repositoryName, `dvc add ${filePaths.join(' ')}`);
        // fetch the previous version from the db to delete and update the existing files
        /**
        * move and delete files:
        *   - prepare all the required subDirs (mandatory)
        *   - generate the source list
        *       - fetch the current files list
        *       - diff the current map from the existing one (this can be combined with the move to avoid multiple iterations)
        *   - use 'dvc move' to move the files(auto updates the gitignore):
        *   - use 'dvc remove' on the .dvc files to delete the files(auto updates the gitignore):
        *
        * cleanups:
        *   - drop empty directories and empty git ignore files
        *     make sure the directory is really empty and has no subDirs!
        *
        * update dvc:
        *      dvc push
        */

        git.add('.');
        const { commit } = await git.commit(commitMessage);
        // commit is either '(root-commit) <hash>' || <hash>
        // the length of the hash is 7 chars
        return {
            commitHash: commit.length === 7
                ? commit
                : commit.split(' ')[1],
            files: {
                droppedIds: dropped,
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
        await db.dataSources.createVersion({
            name, versionDescription
        });
        const { commitHash, files } = await this.commitChange({
            repositoryName: name,
            files: _files,
            commitMessage: versionDescription
        });
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
