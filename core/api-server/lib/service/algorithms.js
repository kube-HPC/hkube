const merge = require('lodash.merge');

const isEqual = require('lodash.isequal');
const cloneDeep = require('lodash.clonedeep');
const format = require('string-template');
const unitsConverter = require('@hkube/units-converter');
const storageManager = require('@hkube/storage-manager');
const { buildTypes, errorsCode } = require('@hkube/consts');
const executionService = require('./execution');
const stateManager = require('../state/state-manager');
const buildsService = require('./builds');
const versionsService = require('./algorithm-versions');
const validator = require('../validation/api-validator');
const { ResourceNotFoundError, ActionNotAllowed, InvalidDataError, ResourceExistsError } = require('../errors');
const { MESSAGES } = require('../consts/builds');
const formatter = require('../utils/formatters');
const createQueryObjectFromString = (str) => {
    return str?.replace(/\s/g, '').split(',').reduce((acc, cur) => {
        const [k, v] = cur.split(':');
        acc[k] = formatter.parseBool(v);
        return acc;
    }, {});
};
class AlgorithmStore {
    init(config) {
        this._debugUrl = config.debugUrl.path;
        this._defaultAlgorithmReservedMemoryRatio = config.defaultAlgorithmReservedMemoryRatio;

        stateManager.onBuildComplete(async (build) => {
            /**
             * this code runs after a successful build.
             * first, we create a new version, then if there are no versions,
             * we update the current algorithm with the new build image.
             */
            const { buildId, algorithm, algorithmName: name, algorithmImage } = build;
            const versions = await stateManager.getVersions({ name });
            const newAlgorithm = merge({}, algorithm, { algorithmImage, options: { pending: false } });
            const version = await versionsService.createVersion(newAlgorithm, buildId);

            // check if running pipelines
            const runningPipelines = await stateManager.searchJobs({ algorithmName: name, hasResult: false, fields: { jobId: true } });

            // if not versions on this Algorithm or not running pipelines then update Algorithm to new version
            if (versions.length === 0 || runningPipelines.length === 0) {
                stateManager.updateAlgorithm({ ...newAlgorithm, version });
            }
            else {
                // get old algorithm by algorithmName
                const oldAlgorithm = await stateManager.getAlgorithm({ name });

                // set error version is not last
                oldAlgorithm.errors = oldAlgorithm.errors || [];

                oldAlgorithm.errors.push(errorsCode.NOT_LAST_VERSION_ALGORITHM);

                // update Algorithm and no create new version
                stateManager.updateAlgorithm(oldAlgorithm);
            }
        });
    }

    async getAlgorithm(options) {
        validator.algorithms.validateAlgorithmName(options);
        const algorithm = await stateManager.getAlgorithm(options);
        if (!algorithm) {
            throw new ResourceNotFoundError('algorithm', options.name);
        }
        return algorithm;
    }

    async getAlgorithms(options) {
        const { name, sort, limit } = options || {};
        return stateManager.getAlgorithms({ name, sort, limit });
    }

    async searchAlgorithm(options) {
        const { name, kind, algorithmImage, pending, cursor, page, sort, limit, fields } = options || {};
        let algorithmImageBoolean;
        if (algorithmImage !== undefined) {
            algorithmImageBoolean = algorithmImage === 'true';
        }
        return stateManager.searchAlgorithms({ name, kind, algorithmImage: algorithmImageBoolean, pending, cursor, page, sort, limit, fields: createQueryObjectFromString(fields) });
    }

    async insertAlgorithm({ payload, options, file }) {
        const { failOnError = true, allowOverwrite } = options || {};
        try {
            validator.algorithms.validateAlgorithmName(payload);
        }
        catch (error) {
            if (failOnError) {
                throw new InvalidDataError(error.message);
            }
            else {
                return {
                    error: {
                        name: payload.name,
                        code: 400,
                        message: error.message
                    }
                };
            }
        }
        const alg = await stateManager.getAlgorithm(payload);
        if (alg) {
            if (allowOverwrite) {
                try {
                    const updatedAlgorithm = await this.updateAlgorithm({ payload, options: { forceUpdate: true }, file });
                    return updatedAlgorithm;
                }
                catch (error) {
                    return {
                        error: {
                            name: payload.name,
                            code: 400,
                            message: `Error updating ${payload.name} ${error.message}`
                        }
                    };
                }
            }
            if (failOnError) {
                throw new ResourceExistsError('algorithm', payload.name);
            }
            return {
                error: {
                    code: 409,
                    message: `algorithm ${payload.name} already exists`
                }
            };
        }
        try {
            const { algorithm } = await this.applyAlgorithm({ payload, file });
            return algorithm;
        }
        catch (error) {
            return {
                error: {
                    name: payload.name,
                    code: 400,
                    message: error.message,
                },
            };
        }
    }

    async updateAlgorithm({ payload, options, file }) {
        validator.algorithms.validateAlgorithmName(payload);
        const alg = await stateManager.getAlgorithm(payload);
        if (!alg) {
            throw new ResourceNotFoundError('algorithm', payload.name);
        }
        const { algorithm } = await this.applyAlgorithm({ payload, options, file });
        return algorithm;
    }

    async deleteAlgorithm(options) {
        validator.algorithms.validateAlgorithmDelete(options);
        const { name, force, keepOldVersions } = options;
        const algorithm = await stateManager.getAlgorithm({ name });
        if (!algorithm) {
            throw new ResourceNotFoundError('algorithm', name);
        }

        const { versions, pipelines, executions } = await this._findAlgorithmDependencies(name);

        if (!force && (pipelines.length > 0 || executions.length > 0)) {
            const { message, details } = await this._checkAlgorithmDependencies({ name, pipelines, executions });
            throw new ActionNotAllowed(message, details);
        }
        else {
            const result = await stateManager.deleteAlgorithm({ name, keepOldVersions });
            const buildPaths = versions.filter(v => v.fileInfo).map(v => v.fileInfo.path);
            await this._deleteAll(buildPaths, (a) => storageManager.delete({ path: a }));
            const pipelineRes = await stateManager.deletePipelines({ names: pipelines.map(p => p.name) });
            const execRes = await this._deleteAll(executions, (a) => executionService.stopJob(a));

            const entities = {
                builds: result.builds,
                versions: result.versions,
                readme: result.readme,
                pipelines: pipelineRes.deleted,
                executions: execRes.length
            };
            const deletedText = this._entitiesToText(entities);
            const summary = `algorithm ${name} successfully deleted from store. related data deleted: ${deletedText}`;
            return summary;
        }
    }

    async _deleteAll(array, func) {
        const res = await Promise.allSettled(array.map(a => func(a)));
        return res.filter(a => a.status === 'fulfilled');
    }

    _entitiesToText(entities) {
        return Object.entries(entities)
            .filter(([, v]) => v)
            .map(([k, v]) => {
                if (Array.isArray(v)) {
                    return `${v.length} ${k} (${v.join(',')})`;
                }
                return `${v} ${k}`;
            })
            .join(', ');
    }

    async _checkAlgorithmDependencies({ name, pipelines, executions }) {
        let message;
        const entities = {
            pipelines: pipelines.map(p => p.name),
            executions: executions.map(e => e.jobId),
        };
        const details = this._entitiesToText(entities);

        if (details) {
            message = `algorithm ${name} is stored in ${details}. you must first delete all related data or use the force flag`;
        }
        return { message, details };
    }

    async _findAlgorithmDependencies(name) {
        const [versions, pipelines, executions] = await Promise.all([
            stateManager.getVersions({ name, fields: { fileInfo: true } }),
            stateManager.searchPipelines({ algorithmName: name }),
            stateManager.searchJobs({ algorithmName: name, hasResult: false, fields: { jobId: true } })
        ]);
        return { versions, pipelines, executions };
    }

    async getAlgorithmsQueueList() {
        return stateManager.getAlgorithmsQueueList();
    }

    /**
     * This method is responsible for create builds, versions, debug data and update algorithm.
     * This method update algorithm if one of the following conditions is valid:
     * 1. The update include new algorithm which is not exists in store.
     * 2. The update explicitly include to override current image.
     *
     */
    async applyAlgorithm(data) {
        const messages = [];
        const messagesCode = [];
        const { forceUpdate, forceBuild } = data.options || {};
        const { version, created, modified, ...payload } = data.payload;
        const file = { path: data.file?.path, name: data.file?.originalname };

        if (!payload.name) {
            throw new InvalidDataError('algorithm should have required property "name"');
        }

        const oldAlgorithm = await stateManager.getAlgorithm(payload);

        if (!oldAlgorithm && !payload.type && !file.path && payload.algorithmImage && payload.fileInfo) {
            delete payload.fileInfo;
        }

        const newAlgorithm = this._mergeAlgorithm(oldAlgorithm, payload);
        validator.algorithms.validateApplyAlgorithm(payload);

        if (!payload.type) {
            newAlgorithm.type = this._resolveType(newAlgorithm, file.path);
        }
        if (oldAlgorithm && oldAlgorithm.type !== newAlgorithm.type) {
            throw new InvalidDataError(`algorithm type cannot be changed from "${oldAlgorithm.type}" to "${newAlgorithm.type}"`);
        }
        if (newAlgorithm.workerCustomResources) {
            const errorOutput = this._validateWorkerCustomResources(newAlgorithm.workerCustomResources);
            if (errorOutput.length > 0) {
                throw new InvalidDataError(`algorithm has invalid workerCustomResources: ${errorOutput.join(', ')}`);
            }
        }
        if (!this._verifyUniqueSideCarContainerNames(payload)) {
            throw new InvalidDataError('Sidecar container names must be unique!');
        }

        await this._validateAlgorithm(newAlgorithm);
        const hasDiff = this._compareAlgorithms(newAlgorithm, oldAlgorithm);
        const buildId = await buildsService.tryToCreateBuild(oldAlgorithm, newAlgorithm, file, forceBuild, messages, messagesCode);

        this._validateApplyParams(newAlgorithm);
        if (!newAlgorithm.algorithmImage && buildId && !oldAlgorithm) {
            newAlgorithm.options.pending = true;
        }
        if (!newAlgorithm.reservedMemory) {
            const memInMb = unitsConverter.getMemoryInMi(newAlgorithm.mem);
            const reservedMemory = Math.ceil(memInMb * this._defaultAlgorithmReservedMemoryRatio);
            newAlgorithm.reservedMemory = `${reservedMemory}Mi`;
        }

        const newVersion = await this._versioning(hasDiff, newAlgorithm, buildId);
        if (newVersion) {
            newAlgorithm.version = newVersion;
            messages.push(format(MESSAGES.VERSION_CREATED, { algorithmName: newAlgorithm.name }));
            messagesCode.push(errorsCode.VERSION_CREATED);
        }

        const hasVersion = !!newVersion || buildId;
        const shouldStoreOverride = (forceUpdate && hasVersion); // has version, but explicitly requested to override
        const shouldStoreFirstApply = !oldAlgorithm; // new algorithm that is not in the store

        if (shouldStoreOverride || shouldStoreFirstApply) {
            messages.push(format(MESSAGES.ALGORITHM_PUSHED, { algorithmName: newAlgorithm.name }));
            messagesCode.push(errorsCode.ALGORITHM_PUSHED);
            await stateManager.updateAlgorithm(newAlgorithm);
        }
        return { buildId, messages, messagesCode, algorithm: newAlgorithm };
    }

    _compareAlgorithms(oldAlgorithm, newAlgorithm) {
        if (!oldAlgorithm) {
            return true;
        }
        return !isEqual(oldAlgorithm, newAlgorithm);
    }

    /**
     * Verifies that all container names in the payload are unique.
     *
     * @param {Object} payload - The payload containing sideCars data.
     * @param {Array} payload.sideCars - Array of sidecar objects.
     * @returns {boolean} - Returns `true` if all container names are unique, otherwise `false`.
     */
    _verifyUniqueSideCarContainerNames(payload) {
        if (!payload.sideCars) return true;
        const containerNames = [];
        return payload.sideCars.every(sideCar => {
            if (sideCar.container && sideCar.container.name) {
                const containerName = sideCar.container.name;
                if (containerNames.includes(containerName)) {
                    return false;
                }
                containerNames.push(containerName);
            }
            return true;
        });
    }

    _resolveType(payload, file) {
        if (file) {
            return buildTypes.CODE;
        }
        if (payload.gitRepository) {
            return buildTypes.GIT;
        }
        return payload.type || buildTypes.IMAGE;
    }

    _validateApplyParams(newAlgorithm) {
        if (!newAlgorithm.algorithmImage && !newAlgorithm.fileInfo && !newAlgorithm.gitRepository) {
            throw new InvalidDataError(`${MESSAGES.APPLY_ERROR}`);
        }
    }

    async _validateAlgorithm(newAlgorithm) {
        validator.algorithms.addAlgorithmDefaults(newAlgorithm);
        await validator.algorithms.validateAlgorithmResources(newAlgorithm);
    }

    _validateWorkerCustomResources(resources) {
        const errors = [];
        if ((resources.requests?.memory && !resources.limits?.memory)) {
            errors.push('limits.memory must be defined');
        }
        if ((resources.limits?.memory && !resources.requests?.memory)) {
            errors.push('requests.memory must be defined');
        }
        if ((resources.requests?.cpu && !resources.limits?.cpu)) {
            errors.push('limits.cpu must be defined');
        }
        if ((resources.limits?.cpu && !resources.requests?.cpu)) {
            errors.push('requests.cpu must be defined');
        }
        return errors;
    }

    _mergeAlgorithm(oldAlgorithm, payload) {
        const old = cloneDeep(oldAlgorithm);
        const newAlgorithm = { ...old, ...payload };
        Object.entries(newAlgorithm).forEach(([k, v]) => {
            if (v === null) {
                delete newAlgorithm[k];
            }
        });
        return newAlgorithm;
    }

    async _versioning(hasDiff, algorithm, buildId) {
        let version;
        if (hasDiff && algorithm.algorithmImage && !buildId) {
            version = await versionsService.createVersion(algorithm);
        }
        return version;
    }
}

module.exports = new AlgorithmStore();
