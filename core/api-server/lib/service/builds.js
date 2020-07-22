const path = require('path');
const merge = require('lodash.merge');
const crypto = require('crypto');
const format = require('string-template');
const semver = require('semver');
const fse = require('fs-extra');
const { diff } = require('deep-diff');
const readChunk = require('read-chunk');
const fileType = require('file-type');
const { uid } = require('@hkube/uid');
const { buildStatuses } = require('@hkube/consts');
const storageManager = require('@hkube/storage-manager');
const stateManager = require('../state/state-manager');
const validator = require('../validation/api-validator');
const { ResourceNotFoundError, InvalidDataError } = require('../errors');
const { MESSAGES } = require('../consts/builds');
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

    async createBuild(file, oldAlgorithm, newAlgorithm) {
        const messages = [];
        let buildId;
        const algorithm = await this._newAlgorithm(file, oldAlgorithm, newAlgorithm);
        const result = this._shouldBuild(oldAlgorithm, algorithm);
        messages.push(...result.messages);

        if (result.shouldBuild) {
            const version = this._incVersion(oldAlgorithm, newAlgorithm);
            buildId = this._createBuildID(algorithm.name);
            const putStream = await storageManager.hkubeBuilds.putStream({ buildId, data: fse.createReadStream(file.path) });
            merge(algorithm, { version, fileInfo: { path: putStream.path } });
            const { env, name, fileInfo, type, baseImage } = algorithm;
            await this.startBuild({ buildId, algorithmName: name, env, version, fileExt: fileInfo.fileExt, type, baseImage });
        }
        return { algorithm, buildId, messages };
    }

    isActiveState(state) {
        return ActiveStates.includes(state);
    }

    async createBuildFromGitRepository(oldAlgorithm, newAlgorithm) {
        const messages = [];
        let buildId;
        const result = this._shouldBuild(oldAlgorithm, newAlgorithm);
        messages.push(...result.messages);

        if (result.shouldBuild) {
            const version = newAlgorithm.gitRepository.commit.id;
            buildId = this._createBuildID(newAlgorithm.name);
            const { env, name, gitRepository, type, baseImage } = newAlgorithm;
            validator.builds.validateAlgorithmBuildFromGit({ env });
            await this.startBuild({ buildId, version, env, algorithmName: name, gitRepository, type, baseImage });
        }
        return { buildId, messages };
    }

    async _newAlgorithm(file, oldAlgorithm, newAlgorithm) {
        const fileInfo = await this._fileInfo(file);
        const env = this._resolveEnv(oldAlgorithm, newAlgorithm);
        validator.builds.validateAlgorithmBuild({ fileExt: fileInfo.fileExt, env });
        return { ...newAlgorithm, fileInfo, env };
    }

    async removeFile(file) {
        if (file && file.path) {
            await fse.remove(file.path);
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
        const { fileInfo, env, gitRepository } = algorithm;
        const checksum = fileInfo && fileInfo.checksum;
        const commit = gitRepository && gitRepository.commit && gitRepository.commit.id;
        return { checksum, env, commit };
    }

    _createBuildID(algorithmName) {
        return [algorithmName, uid({ length: 6 })].join('-');
    }

    _incVersion(oldAlgorithm, newAlgorithm) {
        const oldVersion = oldAlgorithm && oldAlgorithm.version;
        const newVersion = newAlgorithm && newAlgorithm.version;

        let version;
        if (!oldVersion && !newVersion) {
            version = '1.0.0';
        }
        else if (newVersion) {
            version = newVersion;
        }
        else {
            const ver = semver.valid(oldVersion);
            if (!ver) {
                version = oldVersion;
            }
            else {
                const { patch, minor, major } = semver.parse(oldVersion);
                if (patch < 500) {
                    version = semver.inc(oldVersion, 'patch');
                }
                else if (minor < 500) {
                    version = semver.inc(oldVersion, 'minor');
                }
                else if (major < 500) {
                    version = semver.inc(oldVersion, 'major');
                }
            }
        }
        return version;
    }

    _resolveEnv(oldAlgorithm, newAlgorithm) {
        const oldEnv = oldAlgorithm && oldAlgorithm.env;
        const newEnv = newAlgorithm.env;
        let env;

        if (newEnv) {
            env = newEnv;
        }
        else if (oldEnv) {
            env = oldEnv;
        }
        return env;
    }
}

module.exports = new Builds();
