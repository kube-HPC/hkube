const fse = require('fs-extra');
const pathLib = require('path');
const {
    glob,
    Repository: RepositoryBase,
    filePath: { extractRelativePath, getFilePath },
} = require('@hkube/datasource-utils');
const { default: simpleGit } = require('simple-git');
const { Github, Gitlab } = require('./GitRemoteClient');
const normalize = require('./normalize');
const dvcConfig = require('./dvcConfig');
const { serviceName } = require('../../config/main/config.base');
const dedicatedStorage = require('./../DedicatedStorage');
const { ResourceNotFoundError, InvalidDataError } = require('../errors');

/**
 * @typedef {import('@hkube/db/lib/DataSource').GitConfig} GitConfig
 * @typedef {import('@hkube/db/lib/DataSource').StorageConfig} StorageConfig
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

const GitClients = {
    internal: Github,
    github: Github,
    gitlab: Gitlab,
};

class Repository extends RepositoryBase {
    /**
     * @param {string} repositoryName
     * @param {config} config
     * @param {string} rootDir
     * @param {string} repositoryUrl
     * @param {{ git: GitConfig; storage: StorageConfig }} credentials
     */
    constructor(repositoryName, config, rootDir, repositoryUrl, credentials) {
        super(repositoryName, rootDir, repositoryName);
        const RemoteGitClientConstructor = GitClients[credentials.git.kind];
        if (!RemoteGitClientConstructor) {
            throw new InvalidDataError('invalid git kind');
        }
        this.remoteGitClient = new RemoteGitClientConstructor(
            credentials.git,
            repositoryUrl,
            serviceName
        );
        this.config = config;
        this.gitConfig = credentials.git;
        this.storageConfig = credentials.storage;
        this.generateDvcConfig = dvcConfig(
            this.config.dvcStorage,
            this.storageConfig
        );
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
        await fse.ensureDir(`${this.cwd}/data`);
        let repositoryUrl = null;
        try {
            repositoryUrl = await this.remoteGitClient.createRepository(
                this.repositoryName
            );
        } catch (error) {
            if (error.status) {
                throw error;
            }
            throw new Error('failed creating remote repository');
        }
        const git = simpleGit({ baseDir: `${this.cwd}` });
        await git.init();
        await git.addRemote('origin', this.remoteGitClient.repositoryUrl);
        await this._setupDvcRepository();
        await this.createHkubeFile();
        await git.add('.');
        const response = await git.commit('initialized');
        await git.push(['--set-upstream', 'origin', 'master']);
        return {
            ...response,
            commit: response.commit.replace(/(.+) /, ''),
            repositoryUrl,
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

    /** @param {string} [commitHash] */
    async ensureClone(commitHash) {
        await fse.ensureDir(this.cwd);
        const hasClone = await fse.pathExists(`${this.cwd}/.git`);
        if (!hasClone) {
            await simpleGit({ baseDir: this.rootDir }).clone(
                this.remoteGitClient.repositoryUrl
            );
        }
        // @ts-ignore
        this.gitClient = simpleGit({ baseDir: this.cwd });
        if (commitHash) await this.gitClient.checkout(commitHash);
        await this.dvc.config(this.generateDvcConfig(this.repositoryName));
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
        const filesToPull = sourceTargetArray
            .map(([source]) => source)
            .map(f => getFilePath(f));
        await this.dvc.pull(filesToPull);
        return Promise.all(
            sourceTargetArray.map(async ([srcFile, targetFile]) => {
                const srcPath = getFilePath(srcFile);
                const targetPath = getFilePath(targetFile);
                await fse.ensureDir(
                    pathLib.parse(`${this.cwd}/${targetPath}`).dir
                );
                return this.dvc.move(srcPath, targetPath);
            })
        );
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
        try {
            response = await Promise.allSettled([
                dedicatedStorage.delete({
                    path: this.repositoryName,
                }),
                this.remoteGitClient.deleteRepository(this.repositoryName),
            ]);
        } catch (error) {
            if (allowNotFound) return null;
            throw error;
        }
        // @ts-ignore
        if (response[0].length === 0 && !allowNotFound) {
            throw new ResourceNotFoundError('datasource', this.repositoryName);
        }
        return response;
    }
}

module.exports = Repository;
