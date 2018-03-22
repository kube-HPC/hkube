const fs = require('fs-extra');
const path = require('path');
const { getOptionOrDefault } = require('../common/versionUtils')
const { getLatestVersions, changeYamlImageVersion, cloneRepo } = require('../common/githubHelper');
const { YAML_PATH } = require('./consts');
const { FOLDERS } = require('./../consts.js');
const syncSpawn = require('../minikube/sync-spawn');
const recursiveDir = require('recursive-readdir');
const kubernetesApi = require('../minikube/kubernetes-api');

let coreYamlPath = YAML_PATH.core;
let thirdPartyPath = YAML_PATH.thirdParty;
const DEPLOYMENT_REPO = 'deployment';
const HKUBE_APP_LABEL='group=hkube';
const HKUBE_CORE_LABEL='core=true';
const HKUBE_THIRDPARTY_LABEL='thirdparty=true';
const options = {
    core: 'c',
    thirdParty: 't',
}

const deleteHkube = async (args) => {
    for (const key in args) {
        const value = args[key];
        if (!value) {
            continue;
        }
        switch (key) {
            case options.core:
                await _deleteCore(args);
                break;
            case options.thirdParty:
                await _deleteThirdParty(args);
                break;
        }
    }
}

const _deleteCore = async (args)=>{
    await syncSpawn('kubectl',`delete deploy -l ${HKUBE_APP_LABEL},${HKUBE_CORE_LABEL}`);
    await syncSpawn('kubectl',`delete svc -l ${HKUBE_APP_LABEL},${HKUBE_CORE_LABEL}`);
    await syncSpawn('kubectl',`delete pvc -l ${HKUBE_APP_LABEL},${HKUBE_CORE_LABEL}`);
    await syncSpawn('kubectl',`delete pv -l ${HKUBE_APP_LABEL},${HKUBE_CORE_LABEL}`);
    await syncSpawn('kubectl',`delete ds -l ${HKUBE_APP_LABEL},${HKUBE_CORE_LABEL}`);
    await syncSpawn('kubectl',`delete sts -l ${HKUBE_APP_LABEL},${HKUBE_CORE_LABEL}`);
    await syncSpawn('kubectl',`delete secrets -l ${HKUBE_APP_LABEL},${HKUBE_CORE_LABEL}`);
    await syncSpawn('kubectl',`delete serviceaccounts -l ${HKUBE_APP_LABEL},${HKUBE_CORE_LABEL}`);
    await syncSpawn('kubectl',`delete sts -l ${HKUBE_APP_LABEL},${HKUBE_CORE_LABEL}`);
    await syncSpawn('kubectl',`delete sa -l ${HKUBE_APP_LABEL},${HKUBE_CORE_LABEL}`);
    await syncSpawn('kubectl',`delete rolebindings -l ${HKUBE_APP_LABEL},${HKUBE_CORE_LABEL}`);
    await syncSpawn('kubectl',`delete po -l ${HKUBE_APP_LABEL},${HKUBE_CORE_LABEL}`);
    await syncSpawn('kubectl',`delete jobs -l ${HKUBE_APP_LABEL},${HKUBE_CORE_LABEL}`);
    await syncSpawn('kubectl',`delete ingresses -l ${HKUBE_APP_LABEL},${HKUBE_CORE_LABEL}`);
    await syncSpawn('kubectl',`delete configmaps -l ${HKUBE_APP_LABEL},${HKUBE_CORE_LABEL}`);
    await syncSpawn('kubectl',`delete clusterroles -l ${HKUBE_APP_LABEL},${HKUBE_CORE_LABEL}`);
    await syncSpawn('kubectl',`delete clusterrolebindings -l ${HKUBE_APP_LABEL},${HKUBE_CORE_LABEL}`);
}
const _deleteThirdParty = async (args)=>{
    await syncSpawn('kubectl',`delete deploy -l ${HKUBE_APP_LABEL},${HKUBE_THIRDPARTY_LABEL}`);
    await syncSpawn('kubectl',`delete svc -l ${HKUBE_APP_LABEL},${HKUBE_THIRDPARTY_LABEL}`);
    await syncSpawn('kubectl',`delete pvc -l ${HKUBE_APP_LABEL},${HKUBE_THIRDPARTY_LABEL}`);
    await syncSpawn('kubectl',`delete pv -l ${HKUBE_APP_LABEL},${HKUBE_THIRDPARTY_LABEL}`);
    await syncSpawn('kubectl',`delete ds -l ${HKUBE_APP_LABEL},${HKUBE_THIRDPARTY_LABEL}`);
    await syncSpawn('kubectl',`delete sts -l ${HKUBE_APP_LABEL},${HKUBE_THIRDPARTY_LABEL}`);
    await syncSpawn('kubectl',`delete secrets -l ${HKUBE_APP_LABEL},${HKUBE_THIRDPARTY_LABEL}`);
    await syncSpawn('kubectl',`delete serviceaccounts -l ${HKUBE_APP_LABEL},${HKUBE_THIRDPARTY_LABEL}`);
    await syncSpawn('kubectl',`delete sts -l ${HKUBE_APP_LABEL},${HKUBE_THIRDPARTY_LABEL}`);
    await syncSpawn('kubectl',`delete sa -l ${HKUBE_APP_LABEL},${HKUBE_THIRDPARTY_LABEL}`);
    await syncSpawn('kubectl',`delete rolebindings -l ${HKUBE_APP_LABEL},${HKUBE_THIRDPARTY_LABEL}`);
    await syncSpawn('kubectl',`delete po -l ${HKUBE_APP_LABEL},${HKUBE_THIRDPARTY_LABEL}`);
    await syncSpawn('kubectl',`delete jobs -l ${HKUBE_APP_LABEL},${HKUBE_THIRDPARTY_LABEL}`);
    await syncSpawn('kubectl',`delete ingresses -l ${HKUBE_APP_LABEL},${HKUBE_THIRDPARTY_LABEL}`);
    await syncSpawn('kubectl',`delete configmaps -l ${HKUBE_APP_LABEL},${HKUBE_THIRDPARTY_LABEL}`);
    await syncSpawn('kubectl',`delete clusterroles -l ${HKUBE_APP_LABEL},${HKUBE_THIRDPARTY_LABEL}`);
    await syncSpawn('kubectl',`delete clusterrolebindings -l ${HKUBE_APP_LABEL},${HKUBE_THIRDPARTY_LABEL}`);
    await syncSpawn('kubectl',`delete cronjob -l ${HKUBE_APP_LABEL},${HKUBE_THIRDPARTY_LABEL}`);
    await syncSpawn('kubectl',`delete EtcdCluster --all`);
}
module.exports = deleteHkube