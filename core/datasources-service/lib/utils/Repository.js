const childProcess = require('child_process');
const fse = require('fs-extra');
const { parse: parsePath } = require('path');
// const glob = require('glob');
const { default: simpleGit } = require('simple-git');
const normalize = require('./normalize');
const dvcConfig = require('./dvc');
const getFilePath = require('./getFilePath');

/**
 * @typedef {import('./types').FileMeta} FileMeta
 * @typedef {import('./types').MulterFile} MulterFile
 * @typedef {import('./types').NormalizedFileMeta} NormalizedFileMeta
 * @typedef {import('./types').SourceTargetArray} SourceTargetArray
 * @typedef {import('./types').config} config
 */

class Repository {
    /** @param {string} repositoryName */
    /** @param {config} config */
    constructor(repositoryName, config) {
        /** @type {import('simple-git').SimpleGit} */
        this.gitClient = null;
        this.config = config;
        this.repositoryName = repositoryName;
        this.rootDir = config.directories.temporaryGitRepositories;
    }

    /** @param {string} name */
    async _setupDvcRepository() {
        const { config } = this;
        const storage = config.defaultStorage;
        const generateDvcConfig =
            storage === 'fs'
                ? dvcConfig.getFSConfig
                : dvcConfig.getS3Config({
                      endpoint: config.s3.endpoint,
                      bucketName: 'local-hkube-datasource',
                      secretAccessKey: config.s3.secretAccessKey,
                      accessKeyId: config.s3.accessKeyId,
                      useSSL: false,
                  });
        await this._execute('dvc init');
        await fse.writeFile(
            `${this.cwd}/.dvc/config`,
            generateDvcConfig(this.repositoryName)
        );
    }

    async setup() {
        await fse.ensureDir(`${this.cwd}`);
        await fse.ensureDir(`${this.cwd}/data`);
        const git = simpleGit({
            baseDir: `${this.cwd}`,
        });
        await git.init().addRemote('origin', this.repositoryUrl);
        await this._setupDvcRepository();
        await git.add('.');
        const response = await git.commit('initialized');
        await git.push(['--set-upstream', 'origin', 'master']);
        return { ...response, commit: response.commit.replace(/(.+) /, '') };
    }

    async ensureClone() {
        await fse.ensureDir(this.cwd);
        const hasClone = await fse.pathExists(`${this.cwd}/.git`);
        if (!hasClone) {
            await simpleGit({ baseDir: this.rootDir }).clone(
                this.repositoryUrl
            );
        }
        this.gitClient = simpleGit({ baseDir: this.cwd });
    }

    get repositoryUrl() {
        const {
            endpoint,
            user: { name: userName, password },
        } = this.config.git;
        return `http://${userName}:${password}@${endpoint}/hkube/${this.repositoryName}.git`;
    }

    get cwd() {
        return `${this.rootDir}/${this.repositoryName}`;
    }

    async _execute(command) {
        const [mainCmd, ...args] = command.split(' ');
        const cmd = childProcess.spawn(mainCmd, args, {
            cwd: this.cwd,
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

    /**
     * @param {string} repositoryName
     * @param {NormalizedFileMeta} normalizedMapping
     * @param {MulterFile[]} allAddedFiles
     */
    async addFiles(normalizedMapping, allAddedFiles) {
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
        await this._execute(`dvc add ${filePaths.join(' ')}`);

        // await Promise.all(
        //     allAddedFiles.map(file => {
        //         const fileMeta = normalizedMapping[file.filename];
        //         // TODO:: run through all the files and update their respective .dvc
        //         // file with the fileMeta content
        //         console.log({ fileMeta });
        //         return null;
        //     })
        // );

        return null;
    }

    async _pullDvcFile(filePath) {
        await this._execute(
            this.repositoryName,
            `dvc get ${this.repositoryUrl} ${filePath} -o ${filePath}`
        );
    }

    /**
     * @param {string} repositoryName
     * @param {SourceTargetArray[]} sourceTargetArray
     * @param {string} baseDir
     */
    async moveExistingFiles(sourceTargetArray) {
        return Promise.all(
            sourceTargetArray.map(async ([srcFile, targetFile]) => {
                const srcPath = getFilePath(srcFile);
                const repositoryUrl = this.getRepositoryUrl(
                    this.repositoryName
                );
                await this._pullDvcFile(
                    this.repositoryName,
                    repositoryUrl,
                    srcPath
                );
                const targetPath = getFilePath(targetFile);
                await fse.ensureDir(parsePath(`${this.cwd}/${targetPath}`).dir);
                // moves .dvc files and updates gitignore
                return this._execute(
                    this.repositoryName,
                    `dvc move ${srcPath} ${targetPath}`
                );
            })
        );
    }

    /** @returns {FileMeta[]} */
    scanDir() {
        return [];
    }

    // prepareForDownload(currentMapping, fileIds) {}

    /**
     * @param {string} repositoryName
     * @param {string} baseDir
     * @param {string[]} fileIds
     * @param {FileMeta[]} currentFiles
     */
    async dropFiles(fileIds, currentFiles) {
        if (fileIds.length === 0) return;
        const normalizedCurrentFiles = normalize(currentFiles);
        await Promise.all(
            fileIds.map(async id => {
                const path = getFilePath(normalizedCurrentFiles[id]);
                if (!path) return null;
                // drops the dvc file and updates gitignore
                await this._execute(
                    this.repositoryName,
                    `dvc remove ${path}.dvc`
                );
                const fullPath = `${this.cwd}/${path}`;
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
        // TODO:: run through all the files
        // open their .dvc file and extend it with the description
        return contents.reduce(
            (acc, [fileId, description]) => ({
                ...acc,
                [fileId]: { ...acc[fileId], description },
            }),
            normalizedMapping
        );
    }

    async push(commitMessage) {
        await this._execute('dvc push -r storage');
        await this.gitClient.add('.');
        const { commit } = await this.gitClient.commit(commitMessage);
        await this.gitClient.push();
        return commit;
    }

    async cleanup() {
        await fse.remove(this.cwd);
    }
}

module.exports = Repository;
