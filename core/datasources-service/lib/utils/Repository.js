const fse = require('fs-extra');
const pathLib = require('path');
const {
    glob,
    Repository: RepositoryBase,
    filePath: { extractRelativePath, getFilePath },
} = require('@hkube/datasource-utils');
const { default: simpleGit } = require('simple-git');
const normalize = require('./normalize');
const dvcConfig = require('./dvcConfig');
const dedicatedStorage = require('./../DedicatedStorage');
const { ResourceNotFoundError, InvalidDataError } = require('../errors');
const { Github } = require('./GitRemoteClient');
const gitToken = require('./../service/gitToken');

/**
 * @typedef {import('@hkube/db/lib/DataSource').GitConfig} GitConfig
 * @typedef {import('@hkube/db/lib/DataSource').StorageConfig} StorageConfig
 * @typedef {import('@hkube/db/lib/DataSource').Credentials} Credentials
 * @typedef {import('./types').FileMeta} FileMeta
 * @typedef {import('./types').LocalFileMeta} LocalFileMeta
 * @typedef {import('./types').MulterFile} MulterFile
 * @typedef {import('./types').NormalizedFileMeta} NormalizedFileMeta
 * @typedef {import('./types').SourceTargetArray} SourceTargetArray
 * @typedef {import('./types').config} config
 */

/**
 * @typedef {{ [path: string]: T }} ByPath
 * @template T
 */

class Repository extends RepositoryBase {
    /**
     * @param {string}        repositoryName
     * @param {config}        config
     * @param {string}        rootDir
     * @param {GitConfig}     gitConfig
     * @param {StorageConfig} storageConfig
     * @param {Credentials}   credentials
     */
    constructor(
        repositoryName,
        config,
        rootDir,
        gitConfig,
        storageConfig,
        credentials
    ) {
        super(repositoryName, rootDir, repositoryName);
        this.config = config;
        this.rawRepositoryUrl = gitConfig.repositoryUrl;
        this.rawStorageConfig = storageConfig;
        this.storageConfig =
            storageConfig.kind === 'internal'
                ? this.internalStorage.config
                : storageConfig;
        this.gitConfig = gitConfig;
        this.credentials = this.setupCredentials(
            credentials,
            gitConfig,
            storageConfig
        );
        this.generateDvcConfig = dvcConfig(
            this.storageConfig.kind,
            this.storageConfig,
            this.credentials.storage
        );
    }

    /**
     * @type {(
     * source: Credentials,
     * gitConfig: GitConfig,
     * storageConfig: StorageConfig
     * ) => Credentials}
     */
    setupCredentials(source, gitConfig, storageConfig) {
        const { git, storage } = source;
        return {
            git:
                gitConfig.kind === 'internal'
                    ? this.internalGit.credentials
                    : git,
            storage:
                storageConfig.kind === 'internal'
                    ? this.internalStorage.credentials
                    : storage,
        };
    }

    get internalStorage() {
        const credentials = {
            accessKeyId: this.config.s3.accessKeyId,
            secretAccessKey: this.config.s3.secretAccessKey,
        };
        /** @type {StorageConfig} */
        const config = {
            kind: 'S3',
            endpoint: this.config.s3.endpoint,
            bucketName: this.config.s3.bucketName,
        };
        return {
            credentials,
            config,
        };
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

    get repositoryUrl() {
        if (!this.rawRepositoryUrl) return null;
        const url = new URL(this.rawRepositoryUrl);
        const { git } = this.credentials;
        const { kind } = this.gitConfig;
        if (kind === 'gitlab') {
            if (git.token && git.tokenName) {
                url.username = git.tokenName;
                url.password = git.token;
            } else {
                throw new InvalidDataError(
                    "missing gitlab 'token' or 'tokenName'"
                );
            }
            return url.toString();
        }
        if (['github', 'internal'].includes(kind)) {
            if (git.token) {
                url.username = git.token;
            }
            return url.toString();
        }
        throw new InvalidDataError('invalid git kind');
    }

    async _setupDvcRepository() {
        await this.dvc.init();
        await this.dvc.config(this.generateDvcConfig(this.repositoryName));

        await fse.copyFile(
            pathLib.resolve('lib', 'utils', 'dvcConfigTemplates', 's3.txt'),
            pathLib.join(this.dvc.cwd, '.dvc', 'config.template')
        );
    }

    /**
     * @param {FileMeta}      fileMeta
     * @param {LocalFileMeta} metaData
     */
    async _enrichDvcFile(fileMeta, metaData) {
        const nextMeta = { ...(metaData || {}) };
        const filePath = getFilePath(fileMeta);
        const dvcContent = await this.dvc.loadDvcContent(filePath);
        if (dvcContent?.meta?.hkube?.hash) {
            if (dvcContent.meta.hkube.hash === dvcContent.outs[0].md5) {
                // retain the id and upload time if no actual change was made to the file
                // avoids "faking" a change to git if no actual change was made
                nextMeta.id = dvcContent.meta.hkube.id;
                nextMeta.uploadedAt = dvcContent.meta.hkube.uploadedAt;
            }
        }
        return this.dvc.enrichMeta(filePath, dvcContent, 'hkube', nextMeta);
    }

    async setup() {
        // clone the repo, setup dvc in it
        await this.ensureClone(null, false);
        const dir = await fse.readdir(this.cwd);
        if (dir.length > 1 || (dir.length === 1 && dir[0] !== '.git')) {
            throw new InvalidDataError(
                'the provided git repository is not empty'
            );
        }
        await this._setupDvcRepository();
        await this.createHkubeFile();
        await this.gitClient.add('.');
        const response = await this.gitClient.commit('initialized');
        await this.gitClient.push(['--set-upstream', 'origin', 'master']);
        return {
            ...response,
            commit: response.commit.replace(/(.+) /, ''),
        };
    }

    async push() {
        let response;
        try {
            response = await super.push();
        } catch (error) {
            if (typeof error === 'string') {
                if (error.match(/SignatureDoesNotMatch|InvalidAccessKeyId/i)) {
                    throw new InvalidDataError(
                        'invalid S3 accessKeyId or invalid accessKey'
                    );
                }
                if (
                    error.match(
                        /Invalid endpoint|Could not connect to the endpoint URL/i
                    )
                ) {
                    throw new InvalidDataError('invalid S3 endpoint');
                }
                if (error.match(/Bucket '.+' does not exist/i)) {
                    throw new InvalidDataError('S3 bucket name does not exist');
                }
            }
            throw error;
        }
        return response;
    }

    /** @param {string=} commitHash */
    async ensureClone(commitHash, shouldConfigDvc = true) {
        await fse.ensureDir(this.cwd);
        const hasClone = await fse.pathExists(`${this.cwd}/.git`);
        if (!hasClone) {
            try {
                await simpleGit({ baseDir: this.rootDir })
                    .env('GIT_TERMINAL_PROMPT', '0')
                    .clone(this.repositoryUrl);
                const repositoryName = pathLib.parse(this.repositoryUrl).name;
                const currentDir = pathLib.join(this.rootDir, repositoryName);
                fse.rename(currentDir, this.cwd);
            } catch (error) {
                if (
                    error?.message.match(/could not read Password for/i) ||
                    error.message.match(/invalid credentials/i)
                ) {
                    throw new InvalidDataError('Invalid git token');
                }
                throw error;
            }
        }
        // @ts-ignore
        this.gitClient = simpleGit({ baseDir: this.cwd });
        if (commitHash) await this.gitClient.checkout(commitHash);
        if (shouldConfigDvc) return this.configDvc();
        return null;
    }

    async configDvc() {
        return this.dvc.config(this.generateDvcConfig(this.repositoryName));
    }

    /**
     * @param {NormalizedFileMeta} normalizedMapping
     * @param {MulterFile[]}       allAddedFiles
     * @param {ByPath<string>}     metaByPath
     */
    async addFiles(normalizedMapping, allAddedFiles, metaByPath) {
        if (allAddedFiles.length === 0) return null;
        /** @type {{ dirs: string[]; filePaths: string[] }} */
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
            uniqueDirs.map(dir => fse.ensureDir(`${this.cwd}/${dir}`))
        );

        await Promise.all(
            allAddedFiles.map(file => {
                const fileMeta = normalizedMapping[file.filename];
                return fse.move(
                    file.path,
                    `${this.cwd}/${getFilePath(fileMeta)}`,
                    {
                        overwrite: true,
                    }
                );
            })
        );
        // creates .dvc files and update/create the relevant gitignore files
        await this.dvc.add(filePaths);

        await Promise.all(
            allAddedFiles.map(async file => {
                const fileMeta = normalizedMapping[file.filename];
                const filePath = getFilePath(fileMeta);
                const { path, ...rest } = fileMeta;
                await this._enrichDvcFile(fileMeta, {
                    ...rest,
                    meta: metaByPath[filePath] || '',
                });
                return null;
            })
        );

        return null;
    }

    /** @param {SourceTargetArray[]} sourceTargetArray */
    async moveExistingFiles(sourceTargetArray) {
        if (sourceTargetArray.length === 0) return null;
        const fullPathSrcTargetArray = sourceTargetArray.map(
            ([srcFile, targetFile]) => {
                const srcPath = getFilePath(srcFile);
                const targetPath = getFilePath(targetFile);
                return [
                    srcPath,
                    targetPath,
                    pathLib.join(this.cwd, `${srcPath}.meta`),
                    pathLib.join(this.cwd, `${targetPath}.meta`),
                ];
            }
        );
        const filesToPull = fullPathSrcTargetArray.map(([source]) => source);
        await this.dvc.pull(filesToPull);

        const dirs = fullPathSrcTargetArray.map(
            ([, targetPath]) => pathLib.parse(`${this.cwd}/${targetPath}`).dir
        );
        await Promise.all([...new Set(dirs)].map(dir => fse.ensureDir(dir)));

        // using a for loop to run in series
        // dvc move must NOT run in parallel!
        // eslint-disable-next-line no-restricted-syntax
        for await (const arr of fullPathSrcTargetArray) {
            const [srcPath, targetPath, srcMetaPath, targetMetaPath] = arr;
            await this.dvc.move(srcPath, targetPath);
            const hasMeta = await fse.pathExists(srcMetaPath);
            if (hasMeta) {
                try {
                    await fse.move(srcMetaPath, targetMetaPath);
                } catch (error) {
                    console.error({ error });
                }
            }
        }
        return null;
    }

    /** @returns {Promise<FileMeta[]>} */
    async scanDir() {
        const dvcFiles = await glob('**/*.dvc', this.cwd);
        return Promise.all(
            dvcFiles.map(async filePath => {
                const content = await this.dvc.loadDvcContent(filePath);
                const { hash, ...meta } = content.meta.hkube;
                return {
                    path: extractRelativePath(filePath),
                    ...meta,
                };
            })
        );
    }

    /** Drop .git, .dvc dirs from the local copy, removes .gitignore and .dvcignore files */
    async dropNonDataFiles() {
        const metaFiles = await Promise.all([
            glob('**/*.dvc', this.cwd),
            glob('**/.gitignore', this.cwd),
        ]);

        await Promise.all(
            [...['.git', '.dvcignore', '.dvc'], ...metaFiles.flat()].map(file =>
                fse.remove(`${this.cwd}/${file}`)
            )
        );
    }

    /**
     * @param {string[]}   fileIds
     * @param {FileMeta[]} currentFiles
     */
    async dropFiles(fileIds, currentFiles) {
        if (fileIds.length === 0) return;
        const normalizedCurrentFiles = normalize(currentFiles);
        const filePaths = fileIds.map(id =>
            getFilePath(normalizedCurrentFiles[id])
        );
        await this.dvc.remove({ paths: filePaths });
        await Promise.all(
            filePaths.map(async filePath => {
                // drops the dvc file and updates gitignore
                const fullPath = `${this.cwd}/${filePath}`;
                if (await fse.pathExists(fullPath)) {
                    await fse.unlink(fullPath);
                }
                return null;
            })
        );
    }

    /**
     * Loads the .meta files, adds their content to the .dvc files.
     *
     * @param {NormalizedFileMeta} normalizedMapping
     * @param {ByPath<string>}     byPath
     * @param {ByPath<MulterFile>} metaFilesByPath
     * @returns {Promise<ByPath<string>>}
     */
    async loadMetaDataFiles(normalizedMapping, byPath, metaFilesByPath) {
        const entries = await Promise.all(
            Object.entries(metaFilesByPath).map(async ([filePath, file]) => {
                const content = await fse.readFile(file.path);
                const fileId = byPath[filePath];
                const meta = content.toString('utf8');
                const fileMeta = normalizedMapping[fileId];
                await fse.move(
                    file.path,
                    `${this.cwd}/${getFilePath(fileMeta)}.meta`,
                    { overwrite: true }
                );
                return [filePath, meta];
            })
        );
        return Object.fromEntries(entries);
    }

    /**
     * Filters files from a local copy of the repository.
     *
     * @param {FileMeta[]} filesToDrop
     */
    filterFilesFromClone(filesToDrop) {
        return Promise.all(
            filesToDrop
                .map(file => {
                    const filePath = `${this.cwd}/${getFilePath(file)}`;
                    return ['', '.dvc', '.meta'].map(ext =>
                        fse.remove(`${filePath}${ext}`)
                    );
                })
                .flat()
        );
    }

    async filterMetaFilesFromClone() {
        const metaFiles = await glob('**/*.meta', this.cwd);
        return Promise.all(
            metaFiles.map(filePath => fse.remove(`${this.cwd}/${filePath}`))
        );
    }

    /**
     * **PERMANENTLY** delete the repository from db, storage and git. if you
     * want to delete a local copy use *Repository.deleteClone*
     */
    async delete(allowNotFound = false) {
        let response;
        const promises = [];
        const { kind: storageKind } = this.rawStorageConfig;
        if (storageKind === 'internal') {
            promises.push(
                dedicatedStorage.delete({
                    path: this.repositoryName,
                })
            );
        }
        if (this.gitConfig.kind === 'internal') {
            const remoteGitClient = new Github(
                {
                    endpoint: this.config.git.github.endpoint,
                    kind: 'internal',
                    token: null,
                },
                this.rawRepositoryUrl,
                this.config.serviceName
            );
            promises.push(
                remoteGitClient.deleteRepository(this.repositoryName)
            );
        }
        try {
            response = await Promise.allSettled(promises);
        } catch (error) {
            if (allowNotFound) return null;
            throw error;
        }
        if (response.length === 0) return null;
        if (
            storageKind === 'internal' &&
            // @ts-ignore
            response[0].length === 0 &&
            !allowNotFound
        ) {
            throw new ResourceNotFoundError('datasource', this.repositoryName);
        }
        return response;
    }
}

module.exports = Repository;
