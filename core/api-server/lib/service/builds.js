const path = require('path');
const merge = require('lodash.merge');
const crypto = require('crypto');
const format = require('string-template');
const fse = require('fs-extra');
const { diff } = require('deep-diff');
const readChunk = require('read-chunk');
const fileType = require('file-type');
const { buildStatuses, buildTypes } = require('@hkube/consts');
const storageManager = require('@hkube/storage-manager');
const stateManager = require('../state/state-manager');
const validator = require('../validation/api-validator');
const Build = require('./build');
const { ResourceNotFoundError, InvalidDataError } = require('../errors');
const { MESSAGES } = require('../consts/builds');
const gitDataAdapter = require('./githooks/git-data-adapter');
const ActiveStates = [buildStatuses.PENDING, buildStatuses.CREATING, buildStatuses.ACTIVE];
const minimumBytes = 4100;

class Builds {
    async getBuild(options) {
        validator.builds.validateBuildId(options);
        const response = await stateManager.algorithms.builds.get(options);
        if (!response) {
            throw new ResourceNotFoundError('build', options.buildId);
        }
        return response;
    }

    async getBuilds(options) {
        validator.lists.validateResultList(options);
        const response = await stateManager.algorithms.builds.list(options);
        return response;
    }

    async startBuild(options) {
        const build = {
            ...options,
            status: buildStatuses.PENDING,
            progress: 0,
            result: null,
            error: null,
            trace: null,
            endTime: null,
            startTime: Date.now()
        };
        return stateManager.algorithms.builds.set(build);
    }

    async stopBuild(options) {
        validator.builds.validateBuildId(options);
        const { buildId } = options;
        const build = await this.getBuild({ buildId });
        if (!this.isActiveState(build.status)) {
            throw new InvalidDataError(`unable to stop build because its in ${build.status} status`);
        }
        const buildData = {
            buildId,
            status: buildStatuses.STOPPED,
            endTime: Date.now()
        };
        await stateManager.algorithms.builds.update(buildData);
    }

    async rerunBuild(options) {
        validator.builds.validateBuildId(options);
        const { buildId } = options;
        const build = await this.getBuild({ buildId });
        if (this.isActiveState(build.status)) {
            throw new InvalidDataError(`unable to rerun build because its in ${build.status} status`);
        }
        await this.startBuild(build);
    }

    async _createBuildFromCode(build) {
        if (build.uploadPath) {
            await storageManager.hkubeBuilds.putStream({ buildId: build.buildId, data: fse.createReadStream(build.uploadPath) });
        }
        await this.startBuild(build);
    }

    async _createBuildFromGitRepository(build) {
        await this.startBuild(build);
    }

    isActiveState(state) {
        return ActiveStates.includes(state);
    }

    async tryToCreateBuild(oldAlgorithm, newAlgorithm, file, messagesInfo) {
        let fileInfo;
        let gitRepository;
        let buildId;

        if (file?.path) {
            fileInfo = await this._fileInfo(file);
        }
        else if (newAlgorithm.fileInfo) {
            fileInfo = newAlgorithm.fileInfo;
        }
        else if (newAlgorithm.gitRepository) {
            gitRepository = await gitDataAdapter.getInfoAndAdapt(newAlgorithm);
            merge(newAlgorithm, { gitRepository });
        }
        if (fileInfo || gitRepository) {
            validator.builds.validateAlgorithmBuild({ fileExt: fileInfo?.fileExt, env: newAlgorithm.env });
            const { messages, shouldBuild } = this._shouldBuild(oldAlgorithm, newAlgorithm);
            messagesInfo.push(...messages);
            if (shouldBuild) {
                const build = new Build({
                    env: newAlgorithm.env,
                    algorithm: newAlgorithm,
                    fileExt: fileInfo?.fileExt,
                    filePath: fileInfo?.path,
                    uploadPath: file?.path,
                    algorithmName: newAlgorithm.name,
                    gitRepository: newAlgorithm.gitRepository,
                    type: newAlgorithm.type,
                    baseImage: newAlgorithm.baseImage
                });
                buildId = build.buildId;
                if (fileInfo && !fileInfo.path) {
                    const filePath = storageManager.hkubeBuilds.createPath({ buildId: build.buildId });
                    build.filePath = filePath;
                    fileInfo.path = filePath;
                }
                merge(newAlgorithm, { fileInfo });
                await this._createBuildByType(newAlgorithm.type, build);
            }
        }
        return buildId;
    }

    async _createBuildByType(type, build) {
        if (type === buildTypes.CODE) {
            await this._createBuildFromCode(build);
        }
        else if (type === buildTypes.GIT) {
            await this._createBuildFromGitRepository(build);
        }
    }

    async _fileInfo(file) {
        const bufferExt = await readChunk(file.path, 0, minimumBytes);
        let fileExt = await fileType.fromBuffer(bufferExt);
        if (fileExt) {
            fileExt = fileExt.ext;
        }
        else {
            const ext = path.extname(file.name).split('.');
            fileExt = ext[ext.length - 1];
        }

        const checksum = await this._checkSum(file.path);
        const stat = await fse.stat(file.path);
        const fileSize = stat.size;
        return { fileExt, checksum, fileSize };
    }

    _checkSum(file) {
        return new Promise((resolve, reject) => {
            const stream = fse.createReadStream(file);
            const hash = crypto.createHash('sha1');
            hash.setEncoding('hex');

            stream.on('end', () => {
                hash.end();
                resolve(hash.read());
            });
            stream.on('error', err => reject(err));
            stream.pipe(hash);
        });
    }

    _shouldBuild(oldAlgorithm, newAlgorithm) {
        let shouldBuild = false;
        const messages = [];
        if (!oldAlgorithm) {
            shouldBuild = true;
            messages.push(MESSAGES.FIRST_BUILD);
        }
        else {
            const oldAlg = this._formatDiff(oldAlgorithm);
            const newAlg = this._formatDiff(newAlgorithm);
            const differences = diff(oldAlg, newAlg);
            if (differences) {
                const triggers = differences.map(d => `${d.path.join('.')}`).join(',');
                messages.push(format(MESSAGES.TRIGGER_BUILD, { triggers }));
                shouldBuild = true;
            }
            else {
                messages.push(MESSAGES.NO_TRIGGER_FOR_BUILD);
            }
        }
        return { messages, shouldBuild };
    }

    _formatDiff(algorithm) {
        const { fileInfo, env, baseImage, gitRepository } = algorithm;
        const checksum = fileInfo?.checksum;
        const commit = gitRepository?.commit?.id;
        return { checksum, env, commit, baseImage };
    }
}

module.exports = new Builds();
