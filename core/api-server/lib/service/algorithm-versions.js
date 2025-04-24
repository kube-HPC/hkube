const { errorsCode } = require('@hkube/consts');
const asyncQueue = require('async.queue');
const versioning = require('./versioning');
const validator = require('../validation/api-validator');
const stateManager = require('../state/state-manager');
const { ResourceNotFoundError, ActionNotAllowed } = require('../errors');

class AlgorithmVersions {
    constructor() {
        this._versionsQueue = asyncQueue((task, callback) => {
            versioning.createVersion(task)
                .then(r => callback(null, r))
                .catch(e => callback(e));
        }, 1);
    }

    async getVersions(options) {
        validator.algorithms.validateAlgorithmName(options);
        return versioning.getVersions(options);
    }

    async getVersion({ name, version }) {
        const algorithm = await stateManager.getAlgorithm({ name });
        if (!algorithm) {
            throw new ResourceNotFoundError('algorithm', name);
        }
        const algorithmVersion = await versioning.getVersion({ version });
        if (!algorithmVersion) {
            throw new ResourceNotFoundError('version', version);
        }
        return algorithmVersion;
    }

    async tagVersion(options) {
        const { name, version, pinned, tags } = options;
        validator.algorithms.validateAlgorithmTag(options);
        const ver = await this.getVersion({ name, version });
        await stateManager.updateVersion({ version, pinned, tags });
        return ver;
    }

    async applyVersion(options, userName) {
        const { name, version, force } = options;
        validator.algorithms.validateAlgorithmVersion(options);
        const algorithmVersion = await this.getVersion({ name, version });
        const oldAlgorithm = await stateManager.getAlgorithm({ name: algorithmVersion.algorithm.name });
        // check if running pipelines
        if (!force) {
            const runningPipelines = await stateManager.searchJobs({ algorithmName: name, hasResult: false, fields: { jobId: true } });
            const { length } = runningPipelines;
            if (length > 0) {
                throw new ActionNotAllowed(
                    `there ${length === 1 ? 'is a' : `are ${length}`} running pipeline${length === 1 ? '' : 's'} which depend${length === 1 ? 's' : ''} on "${options.name}" algorithm`,
                    runningPipelines.map(p => p.jobId)
                );
            }
        }
        // Deleting the error check "not last version algorithm"
        if (algorithmVersion.algorithm.errors != null) {
            algorithmVersion.algorithm.errors = algorithmVersion.algorithm?.errors.filter(x => x !== errorsCode.NOT_LAST_VERSION_ALGORITHM);
        }
        // Handle audit for version
        if (!oldAlgorithm.auditTrail) {
            algorithmVersion.algorithm.auditTrail = [];
        }
        const auditEntry = {
            user: userName,
            timestamp: null,
            version: algorithmVersion.version
        };
        algorithmVersion.algorithm.auditTrail = [
            auditEntry,
            ...oldAlgorithm.auditTrail || []
        ];
        //
        await stateManager.updateAlgorithm(algorithmVersion.algorithm);
        return algorithmVersion;
    }

    async deleteVersion(options) {
        const { version, name } = options;
        validator.algorithms.validateAlgorithmVersion({ name, version });
        const algorithm = await stateManager.getAlgorithm({ name });
        if (!algorithm) {
            throw new ResourceNotFoundError('algorithm', name);
        }
        if (algorithm.version === version) {
            throw new ActionNotAllowed('unable to remove the currently used version');
        }
        const algorithmVersion = await versioning.getVersion({ version });
        if (!algorithmVersion) {
            throw new ResourceNotFoundError('version', version);
        }
        const res = await stateManager.deleteVersion({ name, version });
        const deleted = parseInt(res.deleted, 10);
        return { deleted };
    }

    /**
     * This method creates new algorithm version.
     * Version is created for any change in algorithm or after successful build.
     * If the version created after build, a buildId will attached to version.
     * The version has a two important properties that automatically generated.
     *  1. version: <string> (10 length uid).
     *  2. semver:  <string> (major, minor, patch).
     * The algorithm to create version is:
     * 1) generate uid.
     * 2) get the latest semver from versions list.
     * 3) increment the semver.
     * 4) try to acquire lock, so no other user will get the same semver at the same exact time.
     * 5) if lock was unsuccessful, try to increment the semver again.
     * 6) create the version.
     */
    async createVersion(algorithm, buildId, userName) {
        return new Promise((resolve, reject) => {
            this._versionsQueue.push({ algorithm, buildId, userName }, (err, res) => {
                if (err) {
                    return reject(err);
                }
                return resolve(res);
            });
        });
    }

    async getLatestSemver({ name }) {
        return versioning.getLatestSemver({ name });
    }
}

module.exports = new AlgorithmVersions();
