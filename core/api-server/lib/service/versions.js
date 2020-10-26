const semver = require('semver');
const validator = require('../validation/api-validator');
const stateManager = require('../state/state-manager');
const algorithmStore = require('./algorithms-store');
const { ResourceNotFoundError, ActionNotAllowed } = require('../errors');

class AlgorithmVersions {
    async getVersions(options) {
        validator.algorithms.validateAlgorithmName(options);
        const algorithmVersion = await stateManager.algorithms.versions.list(options);
        return algorithmVersion;
    }

    async getVersion({ name, version }) {
        const algorithm = await stateManager.algorithms.store.get({ name });
        if (!algorithm) {
            throw new ResourceNotFoundError('algorithm', name);
        }
        const algorithmVersion = await stateManager.algorithms.versions.get({ version, name });
        if (!algorithmVersion) {
            throw new ResourceNotFoundError('version', version);
        }
        return algorithmVersion;
    }

    async tagVersion(options) {
        const { name, version, pinned, tags } = options;
        validator.algorithms.validateAlgorithmTag(options);
        const ver = await this.getVersion({ name, version });
        await this.updateVersion({ version, name, pinned, tags });
        return ver;
    }

    async applyVersion(options) {
        const { name, version, force } = options;
        validator.algorithms.validateAlgorithmVersion(options);
        const algorithmVersion = await this.getVersion({ name, version });
        if (!force) {
            const runningPipelines = await stateManager.executions.running.list(null, e => e.nodes.find(n => n.algorithmName === name));
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
        const algorithm = await stateManager.algorithms.store.get({ name });
        if (!algorithm) {
            throw new ResourceNotFoundError('algorithm', name);
        }
        if (algorithm.version === version) {
            throw new ActionNotAllowed('unable to remove used version');
        }
        const algorithmVersion = await stateManager.algorithms.versions.get({ name, version });
        if (!algorithmVersion) {
            throw new ResourceNotFoundError('version', version);
        }
        const res = await stateManager.algorithms.versions.delete({ name, version });
        const deleted = parseInt(res.deleted, 10);
        return { deleted };
    }

    // known limitation: parallel versioning not supported (for now)
    async createVersion(algorithm) {
        const { name } = algorithm;
        const latestVersion = await this._getLatestVersion({ name });
        const version = this._version(latestVersion);
        const newVersion = {
            version,
            created: Date.now(),
            name,
            algorithm: { ...algorithm, version }
        };
        await stateManager.algorithms.versions.create(newVersion);
        return version;
    }

    async updateVersion(options) {
        return stateManager.algorithms.versions.update(options);
    }

    async _getLatestVersion({ name }) {
        const versions = await stateManager.algorithms.versions.list({ name, order: 'Create', sort: 'desc', limit: 1 });
        return versions && versions[0] && versions[0].version;
    }

    _version(oldVersion) {
        let version;

        if (!oldVersion) {
            version = '1.0.0';
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
}

module.exports = new AlgorithmVersions();
