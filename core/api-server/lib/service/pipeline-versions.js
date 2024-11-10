const asyncQueue = require('async.queue');
const versioning = require('./versioning');
const validator = require('../validation/api-validator');
const stateManager = require('../state/state-manager');
const { ResourceNotFoundError } = require('../errors');

class PipelineVersions {
    constructor() {
        this._versionsQueue = asyncQueue((task, callback) => {
            versioning.createVersion(task, true)
                .then(r => callback(null, r))
                .catch(e => callback(e));
        }, 1);
    }

    async getVersions(options) {
        validator.pipelines.validatePipelineName(options.name);
        return versioning.getVersions(options, true);
    }

    async getVersion({ name, version }) {
        const pipeline = await stateManager.getPipeline({ name });
        if (!pipeline) {
            throw new ResourceNotFoundError('pipeline', name);
        }
        const pipelineVersion = await versioning.getVersion({ version }, true);
        if (!pipelineVersion) {
            throw new ResourceNotFoundError('version', version);
        }
        return pipelineVersion;
    }

    /**
     * This method creates new pipeline version.
     * Version is created for any change in pipeline.
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
    async createVersion(pipeline) {
        return new Promise((resolve, reject) => {
            this._versionsQueue.push({ pipeline }, (err, res) => {
                if (err) {
                    return reject(err);
                }
                return resolve(res);
            });
        });
    }

    async getLatestSemver({ name }) {
        return versioning.getLatestSemver({ name }, true);
    }
}

module.exports = new PipelineVersions();
