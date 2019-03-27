const Logger = require('@hkube/logger');
const log = Logger.GetLogFromContainer();
const { createJobSpec } = require('../jobs/jobCreator');
const { createDeploymentSpec } = require('../deployments/deploymentCreator');
const kubernetes = require('../helpers/kubernetes');
const { findVersion } = require('../helpers/images');
const component = require('../consts/componentNames').RECONCILER;
const { normalizeDeployments, normalizeAlgorithms, normalizeJobs } = require('./normalize');
const CONTAINERS = require('../consts/containers');

const _createJob = (jobDetails) => {
    const spec = createJobSpec(jobDetails);
    const jobCreateResult = kubernetes.createJob({ spec });
    return jobCreateResult;
};

const _createDeployment = async (algorithmName, options) => {
    log.debug(`need to add ${algorithmName} with details ${JSON.stringify(options, null, 2)}`, { component });
    const spec = createDeploymentSpec({ algorithmName, ...options });
    const deploymentCreateResult = await kubernetes.createDeployment({ spec });
    return deploymentCreateResult;
};

const _updateDeployment = async (deployment, options) => {
    const { algorithmName } = deployment;
    log.debug(`need to add ${algorithmName} with details ${JSON.stringify(options, null, 2)}`, { component });
    const spec = createDeploymentSpec({ algorithmName, ...options });
    const deploymentCreateResult = await kubernetes.updateDeployment({ spec });
    return deploymentCreateResult;
};

const reconcile = async ({ deployments, algorithms, versions, registry, clusterOptions } = {}) => {
    const version = findVersion({ versions, repositoryName: CONTAINERS.ALGORITHM_QUEUE });
    const normDeployments = normalizeDeployments(deployments);
    const normAlgorithms = normalizeAlgorithms(algorithms);
    const added = normAlgorithms.filter(a => !normDeployments.find(d => d.algorithmName === a.name));
    const removed = normDeployments.filter(d => !normAlgorithms.find(a => d.algorithmName === a.name));
    const updated = normDeployments.filter(d => d.image.tag !== version);
    log.debug(`added:\n ${JSON.stringify(added, null, 2)}\nremoved:\n${JSON.stringify(removed, null, 2)}\nupdated:\n${JSON.stringify(updated, null, 2)}`);
    const createPromises = [];
    const reconcileResult = {};
    for (let algorithm of added) { // eslint-disable-line
        createPromises.push(_createDeployment(algorithm.name, { version, registry, clusterOptions }));
    }
    for (let algorithm of removed) { // eslint-disable-line
        createPromises.push(kubernetes.deleteDeployment(algorithm.name));
    }
    for (let deployment of updated) { // eslint-disable-line
        createPromises.push(_updateDeployment(deployment, { version, registry, clusterOptions }));
    }

    await Promise.all(createPromises);
    return reconcileResult;
};

// TODO: clean algorithm-builder k8s Jobs
const reconcileBuilds = async ({ builds, jobs, versions, registry, options }) => {
    const version = findVersion({ versions, repositoryName: CONTAINERS.ALGORITHM_BUILDER });
    const normJobs = normalizeJobs(jobs, j => !j.status.succeeded);
    const added = builds.filter(a => !normJobs.find(d => d.buildId === a.buildId));
    const createPromises = [];

    for (let build of added) { // eslint-disable-line
        createPromises.push(_createJob({ buildId: build.buildId, version, registry, options })); // eslint-disable-line
    }

    await Promise.all(createPromises);
};

module.exports = {
    reconcile,
    reconcileBuilds
};
