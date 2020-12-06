const semverLib = require('semver');
const { uid } = require('@hkube/uid');
const validator = require('../validation/api-validator');
const stateManager = require('../state/state-manager');
const algorithmStore = require('./algorithms-store');
const db = require('../db');
const { ResourceNotFoundError, ActionNotAllowed } = require('../errors');

const SETTINGS = {
    SEMVER: {
        FIRST: '1.0.0',
        MAX_PATCH: 500,
        MAX_MINOR: 500,
        MAX_MAJOR: 500,
        MAX_LOCK_ATTEMPTS: 5
    },
    VERSION_LENGTH: 10
};

class AlgorithmVersions {
    async getVersions(options) {
        validator.algorithms.validateAlgorithmName(options);
        const { name } = options;
        const versions = await this.getVersionsList({ name });
        return versions;
    }

    async getVersion({ name, version }) {
        const algorithm = await algorithmStore.getAlgorithm({ name });
        if (!algorithm) {
            throw new ResourceNotFoundError('algorithm', name);
        }
        const algorithmVersion = await this._getVersion({ version });
        if (!algorithmVersion) {
            throw new ResourceNotFoundError('version', version);
        }
        return algorithmVersion;
    }

    async tagVersion(options) {
        const { name, version, pinned, tags } = options;
        validator.algorithms.validateAlgorithmTag(options);
        const ver = await this.getVersion({ name, version });
        await db.algorithms.versions.update({ version, pinned, tags });
        return ver;
    }

    async applyVersion(options) {
        const { name, version, force } = options;
        validator.algorithms.validateAlgorithmVersion(options);
        const algorithmVersion = await this.getVersion({ name, version });
        if (!force) {
            const runningPipelines = await db.jobs.fetchRunningByAlgorithmName({ algorithmName: name });
            if (runningPipelines.length > 0) {
                throw new ActionNotAllowed(`there are ${runningPipelines.length} running pipelines which dependent on "${options.name}" algorithm`, runningPipelines.map(p => p.jobId));
            }
        }
        await algorithmStore.storeAlgorithm(algorithmVersion.algorithm);
        return algorithmVersion;
    }

    async deleteVersion(options) {
        const { version, name } = options;
        validator.algorithms.validateAlgorithmVersion({ name, version });
        const algorithm = await algorithmStore.getAlgorithm({ name });
        if (!algorithm) {
            throw new ResourceNotFoundError('algorithm', name);
        }
        if (algorithm.version === version) {
            throw new ActionNotAllowed('unable to remove used version');
        }
        const algorithmVersion = await this._getVersion({ version });
        if (!algorithmVersion) {
            throw new ResourceNotFoundError('version', version);
        }
        const res = await db.algorithms.versions.delete({ name, version });
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
    async createVersion(algorithm, buildId) {
        const { name } = algorithm;
        const version = uid({ length: SETTINGS.VERSION_LENGTH });
        const latestSemver = await this._getLatestSemver({ name });
        let semver = this._incSemver(latestSemver);

        try {
            semver = await this._lockSemver(name, semver);
            const newVersion = {
                version,
                semver,
                buildId,
                created: Date.now(),
                name,
                algorithm: { ...algorithm, version }
            };
            await db.algorithms.versions.create(newVersion);
        }
        finally {
            await this._releaseSemver(name, semver);
        }
        return version;
    }

    async _releaseSemver(name, semver) {
        await stateManager.algorithms.versions.releaseLock({ name, version: semver });
    }

    async _lockSemver(name, semver) {
        let attempts = 0;
        let success = false;
        let semVersion = semver;
        while (!success && attempts < SETTINGS.SEMVER.MAX_LOCK_ATTEMPTS) {
            const lock = await stateManager.algorithms.versions.acquireLock({ name, version: semVersion }); // eslint-disable-line
            success = lock.success;
            if (!success) {
                attempts += 1;
                semVersion = this._incSemver(semVersion);
            }
        }
        return semVersion;
    }

    async _getLatestSemver({ name }) {
        const versions = await this.getVersionsList({
            name,
            limit: 1
        });
        return versions?.[0]?.semver;
    }

    async _getVersion({ version }) {
        const algorithmVersion = await db.algorithms.versions.fetch({ version });
        return algorithmVersion;
    }

    async getVersionsList({ name, limit }) {
        const versions = await db.algorithms.versions.fetchAll({
            query: { name },
            sort: { created: 'desc' },
            limit
        });
        return versions;
    }

    _incSemver(oldVersion) {
        let version;

        if (!oldVersion) {
            version = SETTINGS.SEMVER.FIRST;
        }
        else {
            const ver = semverLib.valid(oldVersion);
            if (!ver) {
                version = oldVersion;
            }
            else {
                const { patch, minor, major } = semverLib.parse(oldVersion);
                if (patch < SETTINGS.SEMVER.MAX_PATCH) {
                    version = semverLib.inc(oldVersion, 'patch');
                }
                else if (minor < SETTINGS.SEMVER.MAX_MINOR) {
                    version = semverLib.inc(oldVersion, 'minor');
                }
                else if (major < SETTINGS.SEMVER.MAX_MAJOR) {
                    version = semverLib.inc(oldVersion, 'major');
                }
            }
        }
        return version;
    }
}

module.exports = new AlgorithmVersions();
