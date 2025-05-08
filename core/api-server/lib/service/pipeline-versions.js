const asyncQueue = require('async.queue');
const versioning = require('./versioning');
const validator = require('../validation/api-validator');
const stateManager = require('../state/state-manager');
const { ResourceNotFoundError, ActionNotAllowed } = require('../errors');

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

    async applyVersion(options, userName) {
        const { name, version } = options;
        validator.pipelines.validatePipelineVersion(options);
        const pipelineVersion = await this.getVersion({ name, version });
        const oldPipeline = await stateManager.getPipeline({ name });
        // Handle audit for version
        if (!oldPipeline.auditTrail) {
            pipelineVersion.pipeline.auditTrail = [];
        }
        const auditEntry = {
            user: userName,
            timestamp: null,
            version: pipelineVersion.version
        };
        pipelineVersion.pipeline.auditTrail = [
            auditEntry,
            ...oldPipeline.auditTrail || []
        ];
        //
        await stateManager.updatePipeline(pipelineVersion.pipeline);
        return pipelineVersion;
    }

    async deleteVersion(options) {
        const { version, name } = options;
        validator.pipelines.validatePipelineVersion({ name, version });
        const pipeline = await stateManager.getPipeline({ name });
        if (!pipeline) {
            throw new ResourceNotFoundError('pipeline', name);
        }
        if (pipeline.version === version) {
            throw new ActionNotAllowed('unable to remove the currently used version');
        }
        const pipelineVersion = await versioning.getVersion({ version }, true);
        if (!pipelineVersion) {
            throw new ResourceNotFoundError('version', version);
        }
        const res = await stateManager.deleteVersion({ name, version }, true);
        const deleted = parseInt(res.deleted, 10);
        return { deleted };
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
    async createVersion(pipeline, userName) {
        return new Promise((resolve, reject) => {
            this._versionsQueue.push({ pipeline, userName }, (err, res) => {
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
