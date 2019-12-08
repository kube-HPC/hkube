const clonedeep = require('lodash.clonedeep');
const log = require('@hkube/logger').GetLogFromContainer();
const { applyEnvToContainer, applyStorage } = require('@hkube/kubernetes-client').utils;
const { applyImage } = require('../helpers/kubernetes-utils');
const component = require('../consts/componentNames').K8S;
const { deploymentBoardTemplate, boardIngress, boardService } = require('../templates/tensorboard');
const CONTAINERS = require('../consts/containers');

const applyBoardId = (inputSpec, algorithmName, containerName) => {
    const spec = clonedeep(inputSpec);
    spec.metadata.labels['algorithm-name'] = algorithmName;
    return applyEnvToContainer(spec, containerName, { ALGORITHM_TYPE: algorithmName });
};

const applyNodeSelector = (inputSpec, clusterOptions = {}) => {
    const spec = clonedeep(inputSpec);
    if (!clusterOptions.useNodeSelector) {
        delete spec.spec.template.spec.nodeSelector;
    }
    return spec;
};

const createKindsSpec = ({ boardId, log_dir, versions, registry, clusterOptions, workerEnv, options }) => {
    if (!boardId) {
        const msg = 'Unable to create deployment spec. boardId is required';
        log.error(msg, { component });
        throw new Error(msg);
    }

    const deployment = deploymentBoardTemplate(boardId);
    let deploymentSpec = clonedeep(deployment);
    deploymentSpec = applyNodeSelector(deploymentSpec, clusterOptions);
    deploymentSpec = applyEnvToContainer(deploymentSpec, CONTAINERS.TENSORBOARD, workerEnv);
    deploymentSpec = applyEnvToContainer(deploymentSpec, CONTAINERS.TENSORBOARD, { S3_ENDPOINT: '40.69.222.75:30999' });
    deploymentSpec = applyEnvToContainer(deploymentSpec, CONTAINERS.TENSORBOARD, { aws_access_key_id: 'AKIAIOSFODNN7EXAMPLE' });
    deploymentSpec = applyEnvToContainer(deploymentSpec, CONTAINERS.TENSORBOARD, { aws_secret_access_key: 'wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY' });
    deploymentSpec = applyEnvToContainer(deploymentSpec, CONTAINERS.TENSORBOARD, { log_dir });
    deploymentSpec = applyImage(deploymentSpec, CONTAINERS.TENSORBOARD, versions, registry);
    deploymentSpec = applyBoardId(deploymentSpec, boardId, CONTAINERS.TENSORBOARD);
    deploymentSpec = applyStorage(deploymentSpec, 's3', CONTAINERS.TENSORBOARD, 'algorithm-operator-configmap');

    const ingressSpec = boardIngress(boardId, clusterOptions);
    const serviceSpec = boardService(boardId);

    return {
        deploymentSpec,
        ingressSpec,
        serviceSpec
    };
};

module.exports = {
    createKindsSpec
};
