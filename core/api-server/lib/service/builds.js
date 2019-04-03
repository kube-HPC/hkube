const path = require('path');
const crypto = require('crypto');
const uuidv4 = require('uuid/v4');
const format = require('string-template');
const semver = require('semver');
const fse = require('fs-extra');
const { diff } = require('deep-diff');
const readChunk = require('read-chunk');
const fileType = require('file-type');
const storageManager = require('@hkube/storage-manager');
const stateManager = require('../state/state-manager');
const validator = require('../validation/api-validator');
const { ResourceNotFoundError, InvalidDataError } = require('../errors');
const States = require('../state/States');
const { MESSAGES } = require('../consts/builds');

class Builds {
    async getBuild(options) {
        validator.validateBuildId(options);
        const response = await stateManager._etcd._client.get(`/algorithms/builds/${options.buildId}`, { isPrefix: false });
        if (!response) {
            throw new ResourceNotFoundError('build', options.buildId);
        }
        return response;
    }

    async getBuilds(options) {
        validator.validateResultList(options);
        const response = await stateManager._etcd._client.getByQuery(`/algorithms/builds/${options.name}`);
        return response.map(b => b.value);
    }

    async startBuild(options) {
        const build = {
            ...options,
            status: States.PENDING,
            startTime: Date.now(),
            endTime: null
        };
        return stateManager.setBuild(build);
    }

    async stopBuild(options) {
        validator.validateBuildId(options);
        const { buildId } = options;
        const build = await this.getBuild({ buildId });
        if (!stateManager.isActiveState(build.status)) {
            throw new InvalidDataError(`unable to stop build because its in ${build.status} status`);
        }
        const buildData = {
            buildId,
            status: States.STOPPED,
            endTime: Date.now()
        };
        await stateManager.setBuild(buildData);
    }

    async rerunBuild(options) {
        validator.validateBuildId(options);
        const { buildId } = options;
        const build = await this.getBuild({ buildId });
        if (stateManager.isActiveState(build.status)) {
            throw new InvalidDataError(`unable to rerun build because its in ${build.status} status`);
        }
        await this.startBuild(build);
    }

    async createBuild(file, oldAlgorithm, newAlgorithm) {
        const messages = [];
        let buildID;
        let algorithm = await this._newAlgorithm(file, oldAlgorithm, newAlgorithm);
        const result = this._shouldBuild(oldAlgorithm, algorithm);
        messages.push(...result.messages);

        if (result.shouldBuild) {
            const version = this._incVersion(oldAlgorithm, newAlgorithm);
            algorithm = Object.assign({}, algorithm, { version });
            buildID = await this._storeBuild(file, algorithm);
        }
        return { algorithm, buildID, messages };
    }

    async _storeBuild(file, algorithm) {
        const buildId = this._createBuildID(algorithm.name);
        await storageManager.hkubeBuilds.putStream({ buildId, data: fse.createReadStream(file.path) });
        const { env, name, version, fileInfo } = algorithm;
        await this.startBuild({ buildId, algorithmName: name, env, version, fileExt: fileInfo.fileExt });
        return buildId;
    }

    async _newAlgorithm(file, oldAlgorithm, newAlgorithm) {
        const fileInfo = await this._fileInfo(file);
        const env = this._resolveEnv(oldAlgorithm, newAlgorithm);
        validator.validateAlgorithmBuild({ fileExt: fileInfo.fileExt, env });
        return { ...newAlgorithm, fileInfo, env };
    }

    async removeFile(file) {
        if (file.path) {
            await fse.remove(file.path);
        }
    }

    async _fileInfo(file) {
        const bufferExt = readChunk.sync(file.path, 0, fileType.minimumBytes);
        let fileExt = fileType(bufferExt);
        if (fileExt) {
            fileExt = fileExt.ext;
        }
        else {
            const ext = path.extname(file.name).split('.');
            fileExt = ext[ext.length - 1];
        }

        const checksum = await this._checkSum(file.path);
        const fileSize = fse.statSync(file.path).size;
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
        const { fileInfo, env } = algorithm;
        const checksum = fileInfo && fileInfo.checksum;
        return { checksum, env };
    }

    _createBuildID(algorithmName) {
        return [algorithmName, uuidv4()].join('-');
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
