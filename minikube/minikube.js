const request = require('request');
const fs = require('fs-extra');
const { callDone, done, semaphore } = require('await-done');
const { spawn, execSync, spawnSync } = require('child_process');
const cloneAndCopy = require('./clone-and-copy');
const syncSpawn = require('./sync-spawn');
const delay = require('await-delay');
const colors = require('colors');
const kubernetesApi = require('./kubernetes-api');
const { URL_PATH, YAML_PATH, REGISTRY, GITLAB, MINIKUBE } = require('./consts-minikube');
const Api = require('kubernetes-client');




const _minikube = async (opt) => {
    switch (opt) {
        case MINIKUBE.init:
        case MINIKUBE.initShort:
            return await init();
        case MINIKUBE.start:
        case MINIKUBE.startShort:
            return await startMinikube();
        case MINIKUBE.restart:
        case MINIKUBE.restartShort:
            return await restartMinikube();
        case MINIKUBE.initAndStart:
        case MINIKUBE.initAndStartShort:
         return  await init();
         return await startMinikube();
         case MINIKUBE.initAndStart:
         case MINIKUBE.cleanAndRestartMinikubeShort:
        return  cleanAndRestartMinikube();
        case MINIKUBE.applyCore:
        case MINIKUBE.applyCoreShort:
            return runCore();            
        default:
        return  startMinikube();
    }

}


const init = async () => {
    await _instalVirtualBox();
    await _downloadMinikube();
    await _downloadKubectl();
}




const _instalVirtualBox = async () => {
    return new Promise(async (resolve, reject) => {
        console.log(`downloading virtualBox`.green);
      await  syncSpawn(`wget`, `-q https://www.virtualbox.org/download/oracle_vbox_2016.asc -O- | sudo apt-key add -`)
      await  syncSpawn(`apt-get`, `update`)
        console.log(`installing virtualBox`.green);
      await  syncSpawn(`apt-get`, `install -y virtualbox`)
        resolve();

    });

}



const _downloadMinikube = async () => {
    console.log('start download minikube...'.green);
    let { path, url, name } = URL_PATH.minikube;
    await cloneAndCopy(path, url, name);
    console.log('download minikube finished successfully...'.green);

};
const _downloadKubectl = async () => {
    console.log('start download kubectl...'.green);
    let { path, url, name } = URL_PATH.kubectl;
    await cloneAndCopy(path, url, name);
    console.log('download kubectl finished successfully...'.green);
};



const startMinikube = async () => {
    let args = `start --cpus 3 --memory=8192 --insecure-registry ${REGISTRY} `;
    console.log(`start new minikube with the following args: ${args}`.green);
    await syncSpawn('minikube', args);
    await delay(5000)
    console.log(`login to docker registry`.green);
    await registryLogin();
    console.log(`start running system dependencies`.green);
    await runPreRequisite();
    console.log(`running core modules`.green);
    await runCore();
    console.log(`finished successfully`.green);

}
const restartMinikube = async () => {
    console.log(`stopping minikube`.green);
    try {
        await syncSpawn(`minikube`, `stop`);
        await startMinikube();
    } catch (e) {
        console.log(e)
    }

}
const cleanAndRestartMinikube = async () => {
    console.log(`cleaning old minikube`.green);
    try {
        await syncSpawn(`minikube`, `delete`);
        await startMinikube();
    } catch (e) {
        console.log(e)
    }

}


const runPreRequisite = async () => {
    await kubernetesApi.createPodsSync(YAML_PATH.thirdParty);
}

const registryLogin = async () => {
    await syncSpawn(`kubectl`, `create secret docker-registry regsecret --docker-server=${REGISTRY} 
    --docker-username=${GITLAB.user} --docker-password=${GITLAB.token} 
    --docker-email=${GITLAB.email}`)

}
const runCore = async () => {
    fs.readdirSync(YAML_PATH.core).forEach(file => {
        syncSpawn(`kubectl`, `apply -f ${YAML_PATH.core}/${file}`)
    })
}



const downloadDependencies = async () => {
    await _downloadMinikube();
    await _downloadKubectl();

}

module.exports = _minikube;
//startMinikube();
//downloadDependencies();