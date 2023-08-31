const fse = require('fs-extra');
const {
    filePath: { getFilePath },
    createFileMeta,
} = require('@hkube/datasource-utils');
const { StatusCodes } = require('http-status-codes');
const { execSync } = require('child_process');
const path = require('path');
const { extractRelativePath } = require('@hkube/datasource-utils/lib/filePath');
const yaml = require('js-yaml');
const Repository = require('../utils/Repository');
const validator = require('../validation');
const dbConnection = require('../db');
const normalize = require('../utils/normalize');
const { ResourceNotFoundError } = require('../errors');
const { Github } = require('../utils/GitRemoteClient');
const gitToken = require('./gitToken');
const { getDatasourcesInUseFolder } = require('../utils/pathUtils');

const convertWhiteSpace = (str, to) => str.split(' ').join(to);
const metaRegex = new RegExp('.meta');
const isMetaFile = fileName => fileName.match(metaRegex);

const extractFileName = metaData => metaData.input.slice(0, metaData.index);

class DataSource {
    async init(config) {
        this.config = config;
        this.db = dbConnection.connection;
        await fse.ensureDir(this.config.directories.gitRepositories);
    }

    /**
     * Converts temporary ids given by the client to permanent ids. fills in missing details for all
     * the files.
     *
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
                    return {
                        ...acc,
                        metaFilesByPath: {
                            ...acc.metaFilesByPath,
                            [_path]: file,
                        },
                    };
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
     * Splits the inputs to groups by their respective actions. **note**: the normalizedAddedFiles
     * collection includes all the added files including updated file.
     *
     */
    _categorizeFiles({
        currentFiles = [],
        mapping,
        addedFiles: _addedFiles = [],
    }) {
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

    // this function creates an object that can be give info to the object that is pushed into the db about the dvc file created
    async dvcFileObj(directory, file) {
        const dvcObj = {};
        const dvcFile = (await fse.readFile(path.join(directory, `${file}.dvc`))).toString('utf-8');
        const fileName = path.basename(file, path.extname(file));
        dvcObj.originalname = fileName;
        dvcObj.mimetype = `text/${path.extname(file)}`;
        // console.log(dvcFile);
        const arrFile = dvcFile.split('\n');
        for (let i = 0; i < arrFile.length; i += 1) {
            arrFile[i] = arrFile[i].split(': ');
            for (let j = 0; j < arrFile[i].length; j += 1) {
                arrFile[i][j] = arrFile[i][j].trim();
            }
        }
        for (let i = 0; i < arrFile.length; i += 1) {
            if (arrFile[i][0] === 'size') {
                const [, size] = arrFile[i];
                // const [size] = arr2;
                dvcObj.size = size;
            }
        }
        let rPath = '';
        try {
            rPath = extractRelativePath(path.parse(path.join(directory.replace(this.config.directories.dataSourcesInUse, ''), file).dir));
        }
        catch (error) {
            return error;
        }
        return { fileObj: dvcObj, relativePath: rPath };
    }

    async dvcYamlObj(directory) {
        const dvcContent = await fse.readFile(directory, 'utf-8');
        const dvcObj = yaml.load(dvcContent);
        return dvcObj;
    }

    async handleUntrackedFiles(repository, directory) {
        // const addedFiles = [];
        // Get the list of untracked files from Git
        const result = execSync('git ls-files --others --exclude-standard', { cwd: path.join(directory, 'data'), encoding: 'utf8' }).toString();

        // Split the result into an array of filenames
        const untrackedFiles = result.trim().split('\n');

        // Filter the .gitignore
        const dataFiles = untrackedFiles.filter(file => !file.endsWith('.gitignore'));

        // Run `dvc add` on these files
        await Promise.all(dataFiles.map(async (file) => {
            if (file) {
                // execSync(`dvc add data/${file}`, { cwd: directory, encoding: 'utf8' });
                repository.dvc.add(`data/${file}`);
                // execSync(`git add data/${file}.dvc`, { cwd: directory, encoding: 'utf8' });
                const { fileObj, relativePath } = await this.dvcFileObj(directory, `data/${file}`);
                const metaObj = createFileMeta(fileObj, relativePath);
                const dvcObj = await this.dvcYamlObj(path.join(directory, `data/${file}`));
                await repository.dvc.enrichMeta(relativePath, dvcObj, 'hkube', metaObj);

                // repository.gitClient.add(`data/${file}.dvc`);
                // addedFiles.push(this.dvcFileObj(directory, `data/${file}`));
            }
        }));
    }

    async commitJobDs({ repository, versionDescription }) {
        await this.handleUntrackedFiles(repository, repository.cwd);
        // const commit = await repository.commitMidPipeline(versionDescription);
        await repository.gitClient.add('data').catch(error => {
            return error;
        });
        const { commit } = await repository.gitClient.commit(versionDescription);

        await repository.push();
        const finalMapping = await repository.scanDir();
        return {
            commitHash: commit,
            files: finalMapping
        };
    }

    async saveJobDs({ name, jobId, nodeName }) {
        const versionDescription = `${jobId}, ${nodeName}`;

        const createdVersion = await this.db.dataSources.createVersion({
            versionDescription,
            name,
        });

        const repository = new Repository(
            name,
            this.config,
            path.join(getDatasourcesInUseFolder(this.config), jobId, name),
            createdVersion.git,
            createdVersion.storage,
            createdVersion._credentials,
            'complete'
        );

        if (!repository.gitClient) {
            try {
                repository.initGitClient();
            }
            catch (error) {
                return error;
            }
        }

        const { commitHash, files } = await this.commitJobDs({ repository, versionDescription });

        return this.db.dataSources.updateFiles({
            name,
            files,
            commitHash,
        });
    }

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
        const commit = await repository.commit(commitMessage);
        await repository.push();
        const finalMapping = await repository.scanDir();
        return {
            commitHash: commit,
            files: finalMapping,
        };
    }

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
            this.config.directories.gitRepositories,
            createdVersion.git,
            createdVersion.storage,
            createdVersion._credentials
        );

        const { commitHash, files } = await this.commitChange({
            repository,
            files: _files,
            commitMessage: versionDescription,
            currentFiles: createdVersion.files,
        });
        await repository.deleteClone();
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

    get internalGit() {
        const credentials = {
            token: gitToken.hash,
            tokenName: null,
        };
        const config = {
            kind: 'internal',
            endpoint: this.config.git.github.endpoint,
        };
        return {
            credentials,
            config,
        };
    }

    async create({ name, git: _git, storage, files: _files }) {
        await validator.dataSources.create({
            name,
            git: _git,
            storage,
            files: _files,
        });

        let { repositoryUrl = null } = _git;
        // create repository when using internal git
        let gitClient;
        if (_git.kind === 'internal') {
            const { credentials, config } = this.internalGit;
            gitClient = new Github({
                ...credentials,
                ...config,
            });
            repositoryUrl = await gitClient.createRepository(name);
        }

        const git = {
            ..._git,
            repositoryUrl,
        };

        const { token, tokenName, ...gitConfig } = git;
        const { accessKeyId, secretAccessKey, ...storageConfig } = storage;

        const credentials = (() => {
            const _credentials = {};
            // if internal do not store tokens to the db
            if (git.kind !== 'internal') {
                _credentials.git = { token, tokenName };
            }
            if (storage.kind !== 'internal') {
                _credentials.storage = {
                    accessKeyId,
                    secretAccessKey,
                };
            }
            return _credentials;
        })();

        const createdDataSource = await this.db.dataSources.create({
            name,
            git: gitConfig,
            storage: storageConfig,
            credentials,
        });

        let updatedDataSource;
        const repository = new Repository(
            name,
            this.config,
            this.config.directories.gitRepositories,
            gitConfig,
            storageConfig,
            credentials
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
        }
        catch (error) {
            await this.db.dataSources.delete({ name }, { allowNotFound: true });
            await repository.delete(true);
            throw error;
        }
        finally {
            await repository.deleteClone();
        }
        return updatedDataSource;
    }

    fetch({ name, id }) {
        return this.db.dataSources.fetch({
            name,
            id,
            isPartial: false,
        });
    }

    async delete({ name }) {
        validator.dataSources.delete({ name });
        const dataSource = await this.db.dataSources.fetchWithCredentials({
            name,
        });

        const repository = new Repository(
            name,
            this.config,
            this.config.directories.gitRepositories,
            dataSource.git,
            dataSource.storage,
            dataSource._credentials
        );
        try {
            await repository.delete();
        }
        catch (error) {
            if (error.isAxiosError && error.response.status === StatusCodes.NOT_FOUND) {
                throw new ResourceNotFoundError('dataSource', name, error);
            }
            else {
                throw error;
            }
        }
        const response = await this.db.dataSources.delete(
            { name },
            { allowNotFound: false }
        );
        return response;
    }

    async fetchDataSources({ names, ids }) {
        return this.db.dataSources.fetchMany({ names, ids });
    }

    async sync({ name }) {
        validator.dataSources.sync({ name });
        const {
            _credentials,
            git,
            storage,
        } = await this.db.dataSources.fetchWithCredentials({ name });
        const repository = new Repository(
            name,
            this.config,
            this.config.directories.gitRepositories,
            git,
            storage,
            _credentials
        );
        try {
            await repository.ensureClone();
        }
        catch (error) {
            await repository.deleteClone();
            if (error.message.match(/not found/i)) {
                throw new ResourceNotFoundError('datasource', name, error);
            }
            throw error;
        }
        const gitLog = await repository.getLog();
        const { latest } = gitLog;
        const files = await repository.scanDir();
        const createdVersion = await this.db.dataSources.createVersion({
            name,
            versionDescription: latest.message,
        });
        const updatedDataSource = await this.db.dataSources.updateFiles({
            id: createdVersion.id,
            commitHash: latest.hash.slice(0, 7),
            files,
        });

        const {
            id,
            versionDescription,
            commitHash,
            filesCount,
            avgFileSize,
            totalSize,
            fileTypes,
        } = updatedDataSource;

        await repository.deleteClone();
        return {
            id,
            name,
            versionDescription,
            commitHash,
            filesCount,
            avgFileSize,
            totalSize,
            fileTypes,
        };
    }

    async list() {
        return this.db.dataSources.listDataSources();
    }

    async listVersions(name) {
        return this.db.dataSources.listVersions({ name });
    }

    async updateCredentials({ name, credentials }) {
        validator.dataSources.updateCredentials({ name, credentials });
        return this.db.dataSources.updateCredentials({ name, credentials });
    }
}

module.exports = new DataSource();
