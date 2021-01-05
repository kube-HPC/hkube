const fse = require('fs-extra');
const { parse: parsePath } = require('path');
const glob = require('glob');
const { default: simpleGit } = require('simple-git');
const yaml = require('js-yaml');
const normalize = require('./normalize');
const dvcConfig = require('./dvcConfig');
const getFilePath = require('./getFilePath');
const DvcClient = require('./DvcClient');

/**
 * @typedef {import('./types').FileMeta} FileMeta
 * @typedef {import('./types').MulterFile} MulterFile
 * @typedef {import('./types').NormalizedFileMeta} NormalizedFileMeta
 * @typedef {import('./types').SourceTargetArray} SourceTargetArray
 * @typedef {import('./types').config} config
 */

const extractRelativePath = filePath => {
    const response = parsePath(filePath.replace('data/', '')).dir;
    if (response === '') return '/';
    return `/${response}`;
};

/**
 * @template T
 * @typedef {{ [path: string]: T }} ByPath
 */

class Repository {
    /**
     * @param {string} repositoryName
     * @param {config} config
     * @param {string} rootDir
     */
    constructor(repositoryName, config, rootDir) {
        /** @type {import('simple-git').SimpleGit} */
        this.gitClient = null;
        this.config = config;
        this.repositoryName = repositoryName;
        this.rootDir = rootDir;
        // this._execute = Shell(this.cwd);
        this.dvc = new DvcClient(this.cwd, this.repositoryUrl);
    }

    /** @param {string} name */
    async _setupDvcRepository() {
        const { config } = this;
        const storage = config.defaultStorage;
        const generateDvcConfig = dvcConfig[storage](config);
        await this.dvc.init();
        await this.dvc.config(generateDvcConfig(this.repositoryName));
    }

    _enrichDvcFile(fileMeta, metaData) {
        return this.dvc.enrichMeta(getFilePath(fileMeta), 'hkube', metaData);
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

    /** @param {string=} versionId */
    async ensureClone(versionId) {
        await fse.ensureDir(this.cwd);
        const hasClone = await fse.pathExists(`${this.cwd}/.git`);
        if (!hasClone) {
            await simpleGit({ baseDir: this.rootDir }).clone(
                this.repositoryUrl
            );
        }
        this.gitClient = simpleGit({ baseDir: this.cwd });
        if (versionId) await this.gitClient.checkout(versionId);
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

    /**
     * @param {NormalizedFileMeta} normalizedMapping
     * @param {MulterFile[]} allAddedFiles
     * @param {ByPath<string>} metaByPath
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

    /** @type {(filePath: string) => Promise<void>} */
    _pullDvcFile(filePath) {
        if (!filePath) {
            throw new Error(`_pullDvcFile: missing filePath ${filePath}`);
        }
        return this.dvc.pull(filePath);
    }

    pullFiles() {
        return this.dvc.pull();
    }

    /** @param {SourceTargetArray[]} sourceTargetArray */
    async moveExistingFiles(sourceTargetArray) {
        return Promise.all(
            sourceTargetArray.map(async ([srcFile, targetFile]) => {
                const srcPath = getFilePath(srcFile);
                await this._pullDvcFile(srcPath);
                const targetPath = getFilePath(targetFile);
                await fse.ensureDir(parsePath(`${this.cwd}/${targetPath}`).dir);
                return this.dvc.move(srcPath, targetPath);
            })
        );
    }

    /** @returns {FileMeta[]} */
    async scanDir() {
        const metaFiles = await new Promise((res, rej) =>
            glob('**/*.dvc', { cwd: this.cwd }, (err, matches) =>
                err ? rej(err) : res(matches)
            )
        );

        return Promise.all(
            metaFiles.map(async filePath => {
                const content = yaml.load(
                    await fse.readFile(`${this.cwd}/${filePath}`)
                ).meta.hkube;
                return {
                    path: extractRelativePath(filePath),
                    ...content,
                };
            })
        );
    }

    // prepareForDownload(currentMapping, fileIds) {}

    /**
     * @param {string[]} fileIds
     * @param {FileMeta[]} currentFiles
     */
    async dropFiles(fileIds, currentFiles) {
        if (fileIds.length === 0) return;
        const normalizedCurrentFiles = normalize(currentFiles);
        const filePaths = fileIds.map(id => {
            const path = getFilePath(normalizedCurrentFiles[id]);
            if (!path) return null;
            return path;
        });
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
     * Loads the .meta files, adds their content to the .dvc files
     *
     * @param {NormalizedFileMeta} normalizedMapping
     * @param {ByPath<string>} byPath
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
                    `${this.cwd}/${getFilePath(fileMeta)}.meta`
                );
                return [filePath, meta];
            })
        );
        return Object.fromEntries(entries);
    }

    async push(commitMessage) {
        await this.dvc.push();
        await this.gitClient.add('.');
        const { commit } = await this.gitClient.commit(commitMessage);
        await this.gitClient.push();
        return commit;
    }

    async cleanup() {
        await fse.remove(this.cwd);
    }

    /**
     * Filters files from a local copy of the repository
     *
     * @param {string} query
     * @param {FileMeta[]} files
     */
    filterFilesFromClone(filesToDrop) {
        return filesToDrop.map(file => {
            const filePath = `${this.cwd}/${getFilePath(file)}`;
            return [
                fse.remove(filePath),
                fse.remove(`${filePath}.dvc`),
                fse.remove(`${filePath}.meta`),
            ];
        });
    }
}

module.exports = Repository;
