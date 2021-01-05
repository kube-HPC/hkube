const path = require('path');
const merge = require('lodash.merge');
const crypto = require('crypto');
const format = require('string-template');
const fse = require('fs-extra');
const { diff } = require('deep-diff');
const readChunk = require('read-chunk');
const fileType = require('file-type');
const Logger = require('@hkube/logger');
const { buildStatuses, buildTypes } = require('@hkube/consts');
const storageManager = require('@hkube/storage-manager');
const validator = require('../validation/api-validator');
const stateManager = require('../state/state-manager');
const Build = require('./build');
const { ResourceNotFoundError, InvalidDataError } = require('../errors');
const { MESSAGES } = require('../consts/builds');
const gitDataAdapter = require('./githooks/git-data-adapter');
const component = require('../consts/componentNames').BUILDS_SERVICE;
const ActiveStates = [buildStatuses.PENDING, buildStatuses.CREATING, buildStatuses.ACTIVE];
const minimumBytes = 4100;
let log;

class Builds {
    async init() {
        log = Logger.GetLogFromContainer();
    }

    async getBuild(options) {
        const { buildId } = options;
        validator.builds.validateBuildId(options);
        const response = await stateManager.getBuild({ buildId });
        if (!response) {
            throw new ResourceNotFoundError('build', buildId);
        }
        return response;
    }

    async getBuilds(options) {
        const { name, sort, limit } = options;
        validator.lists.validateResultList(options);
        const response = await stateManager.getBuilds({
            algorithmName: name,
            sort,
            limit
        });
        return response;
    }

    _cleanBuild(options) {
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
        return build;
    }

    async startBuild(options) {
        const build = this._cleanBuild(options);
        await stateManager.createBuild(build);
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
        await stateManager.updateBuild(buildData);
    }

    async rerunBuild(options) {
        validator.builds.validateBuildId(options);
        const { buildId } = options;
        const buildData = await this.getBuild({ buildId });
        if (this.isActiveState(buildData.status)) {
            throw new InvalidDataError(`unable to rerun build because its in ${buildData.status} status`);
        }
        const build = this._cleanBuild(options);
        await stateManager.updateBuild(build);
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

    async tryToCreateBuild(oldAlgorithm, newAlgorithm, file, forceBuild, messages) {
        let fileInfo;
        let gitRepository;
        let buildId;

        if (file?.path) {
            fileInfo = await this._fileInfo(file);
            merge(newAlgorithm, { fileInfo });
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
            const { message, shouldBuild } = this._shouldBuild(oldAlgorithm, newAlgorithm, forceBuild);
            log.info(message, { component });
            messages.push(message);
            if (shouldBuild) {
                const build = new Build({
                    env: newAlgorithm.env,
                    fileExt: fileInfo?.fileExt,
                    filePath: fileInfo?.path,
                    uploadPath: file?.path,
                    algorithmName: newAlgorithm.name,
                    gitRepository: newAlgorithm.gitRepository,
                    type: newAlgorithm.type,
                    baseImage: newAlgorithm.baseImage,
                    dependencyInstallCmd: newAlgorithm.dependencyInstallCmd
                });
                buildId = build.buildId;
                if (fileInfo && !fileInfo.path) {
                    const filePath = storageManager.hkubeBuilds.createPath({ buildId: build.buildId });
                    build.filePath = filePath;
                    fileInfo.path = filePath;
                    merge(newAlgorithm, { fileInfo });
                }
                build.algorithm = newAlgorithm;
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

    _shouldBuild(oldAlgorithm, newAlgorithm, forceBuild) {
        let shouldBuild = false;
        let message;
        if (forceBuild) {
            shouldBuild = true;
            message = MESSAGES.FORCE_BUILD;
        }
        else if (!oldAlgorithm) {
            shouldBuild = true;
            message = MESSAGES.FIRST_BUILD;
        }
        else {
            const oldAlg = this._formatDiff(oldAlgorithm);
            const newAlg = this._formatDiff(newAlgorithm);
            const differences = diff(oldAlg, newAlg);
            if (differences) {
                const triggers = differences.map(d => `${d.path.join('.')}`).join(',');
                message = format(MESSAGES.TRIGGER_BUILD, { triggers });
                shouldBuild = true;
            }
            else {
                message = MESSAGES.NO_TRIGGER_FOR_BUILD;
            }
        }
        return { message, shouldBuild };
    }

    _formatDiff(algorithm) {
        const { fileInfo, env, baseImage, gitRepository, dependencyInstallCmd } = algorithm;
        const checksum = fileInfo?.checksum;
        const commit = gitRepository?.commit?.id;
        return { checksum, env, commit, baseImage, dependencyInstallCmd };
    }
}

module.exports = new Builds();
