const request = require('request');
const fs = require('fs-extra');
const path = require('path');
const { callDone, done, semaphore } = require('await-done');
const { spawn, execSync, spawnSync } = require('child_process');
const cloneAndCopy = require('./clone-and-copy');
const syncSpawn = require('./sync-spawn');
const simpleGit = require('simple-git');
const delay = require('await-delay');
const colors = require('colors');
const kubernetesApi = require('./kubernetes-api');
const jsYaml = require('js-yaml');
const { getLatestVersions, changeYamlImageVersion } = require('./githubHelper');
const { FOLDERS, GIT_PREFIX } = require('./../consts.js');
const { URL_PATH, YAML_PATH, REGISTRY, GITLAB, MINIKUBE, } = require('./consts-minikube');
const Api = require('kubernetes-client');
let coreYamlPath = YAML_PATH.core;
let thirdPartyYamlPath = YAML_PATH.thirdParty;


const _minikube = async (opt) => {
    switch (opt[0][0]) {
        case MINIKUBE.init:
        case MINIKUBE.initShort:
            return await init();
        case MINIKUBE.start:
        case MINIKUBE.startShort:
            return await startMinikube();
        case MINIKUBE.restart:
        case MINIKUBE.restartShort:
            return await restartMinikube();
        case MINIKUBE.build:
        case MINIKUBE.buildShort:
            return await init();
            return await startMinikube();
        case MINIKUBE.update:
        case MINIKUBE.updateShort:
            return cleanAndRestartMinikube();
        case MINIKUBE.apply:
        case MINIKUBE.applyShort:
            return runCore(opt);
        default:
            return startMinikube();
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
        await syncSpawn(`wget`, `-q https://www.virtualbox.org/download/oracle_vbox_2016.asc -O- | sudo apt-key add -`)
        await syncSpawn(`apt-get`, `update`)
        console.log(`installing virtualBox`.green);
        await syncSpawn(`apt-get`, `install -y virtualbox`)
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
    console.log('check if common exists');
    await cloneDeployment();
    // console.log(`login to docker registry`.green);
    // await registryLogin();
    console.log(`start running system dependencies`.green);
    await runPreRequisite();
    console.log(`running core modules`.green);
    await runCore();
    console.log(`finished successfully`.green);

}


const cloneDeployment = async () => {
    console.log(`trying to find if hkube is cloned on your pc`.green);
    if (!fs.existsSync(`${FOLDERS.dev}/deployment`)) {
        let sema = new semaphore();
        let git = simpleGit(__dirname);
        let commonPath = `${__dirname}/deployment`
        let basePath = `${commonPath}/kubernetes/yaml`
        coreYamlPath = `${basePath}/core`
        thirdPartyYamlPath = `${basePath}/thirdParty`
        console.log(`deployment folder was not found trying to clone/pull the latest version into the execution path`.green);
        if (!fs.existsSync(`${commonPath}`)) {
            console.log(`deployment is not found under the execution path trying to clone it`.green);
            git.clone(`${GIT_PREFIX.dev}/deployment`, null, `${commonPath}`, (error, r) => {
                console.log(`cloned successfully: ${commonPath}`.green)
                sema.callDone();
            })
            await sema.done();
        }
        else {
            console.log(`deployment folder already exists trying to get latest version`.green);
            git.cwd(commonPath).pull(res => {
                console.log(`repo ${commonPath} pull finished `.green)
                if (res) {
                    console.log(res)
                }
                else {
                    console.log(`everything is up to data`.green);
                }
                sema.callDone()
            })
            await sema.done();

        }

    }
    else {
        console.log(`deployment is already exists in dev folder`.green);
    }
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
    await kubernetesApi.createPodsSync(thirdPartyYamlPath);
}

const registryLogin = async () => {
    await syncSpawn(`kubectl`, `create secret docker-registry regsecret --docker-server=${REGISTRY} 
    --docker-username=${GITLAB.user} --docker-password=${GITLAB.token} 
    --docker-email=${GITLAB.email}`)

}
const runCore = async (opts) => {
    opts=opts||[];
    let versionPrefix = (opts.find(o => o[0] === MINIKUBE.apply || o[0] === MINIKUBE.applyShort) || [])[1];
    if (versionPrefix === true) {
        versionPrefix = 'latest'
    }
    const versions = await getLatestVersions(versionPrefix);
    fs.readdirSync(coreYamlPath).forEach(file => {
        // const projectName = path.basename(file,path.extname(file));
        // const version = versions.versions.find(v=>v.project === projectName);
        const tmpFile = changeYamlImageVersion(file, versions)
        syncSpawn(`kubectl`, `apply -f ${tmpFile}`)
    })
}



const downloadDependencies = async () => {
    await _downloadMinikube();
    await _downloadKubectl();

}

module.exports = _minikube;
//startMinikube();
//downloadDependencies();