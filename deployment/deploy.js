const fs = require('fs-extra');
const path = require('path');
const { getOptionOrDefault } = require('../common/versionUtils')
const { getLatestVersions, cloneRepo } = require('../common/githubHelper');
const { changeYamlImageVersion } = require('../common/yamlHelpers');
const kubernetes = require('../common/kubernetes');
const { YAML_PATH } = require('./consts');
const { FOLDERS } = require('./../consts.js');
const syncSpawn = require('../minikube/sync-spawn');
const recursiveDir = require('recursive-readdir');
const kubernetesApi = require('../minikube/kubernetes-api');
const tableify = require('tableify');
const tempfile = require('tempfile')

let coreYamlPath = YAML_PATH.core;
let thirdPartyPath = YAML_PATH.thirdParty;
const DEPLOYMENT_REPO = 'deployment';
const options = {
    core: 'c',
    thirdParty: 't',
    source: 's',
    version: 'semver',
    build: 'build',
    folder: 'folder',
    registry: 'registry'

}


const deploy = async (args) => {
    let versions;
    if (args.folder) {
        // set yamls from folder        
        const versionsFile = fs.readFileSync(path.join(args.folder, 'version.json'), { encoding: 'utf8' });
        versions = JSON.parse(versionsFile);
        FOLDERS.hkube = path.resolve(args.folder, '..');
    }
    else {
        const versionPrefix = getOptionOrDefault(args, [options.version]);
        versions = await getLatestVersions(versionPrefix);
    }
    if (!versions) {
        console.error(`Unable to find version ${versionPrefix}`)
        return;
    }
    const clusterName = args.cluster_name || 'cluster.local';
    console.log(`Using cluster name: ${clusterName}`);
    args.cluster_name=clusterName;

    kubernetes.init(args.kubernetesOptions);
    await _createVersionsConfigMap(versions, args);
    // clone deployment first to get all yamls
    if (!args.folder) {
        if (!await _cloneDeployment(versions, args)) {
            return;
        }
    }
    else {
        console.log(`System version: ${versions.systemVersion}`);
        const baseFolderForSources = `${FOLDERS.hkube}/${versions.systemVersion}/sources`;
        const deploymentRepo = versions.versions.find(v => v.project === DEPLOYMENT_REPO);
        if (!deploymentRepo) {
            console.error(`unable to find deployment repo for version ${versions.systemVersion}`);
            return false;
        }
        const deploymentFolder = `${baseFolderForSources}/${deploymentRepo.project}`;
        _setYamlPaths(deploymentFolder);

    }
    // build dockers if needed
    if (args.build) {
        await _buildFromSource(versions, args);
    }

    for (const key in args) {
        const value = args[key];
        if (!value) {
            continue;
        }
        switch (key) {
            case options.core:
                await _applyVersionsCore(versions, args);
                break;
            case options.thirdParty:
                await _applyVersionsThirdParty(versions, args);
                break;
        }
    }
}

const _createVersionsConfigMap = async (versions, args) => {
    const html = tableify(versions);
    const tmpFileName = tempfile('.html');
    console.log(`creating versions html file in ${tmpFileName}`);
    fs.writeFileSync(tmpFileName, html);
    const jsonTmpFileName = tempfile('.json');
    fs.writeJsonSync(jsonTmpFileName, versions);
    await syncSpawn('kubectl', `delete configmap hkube-versions`);
    await syncSpawn('kubectl', `create configmap hkube-versions  --from-file=versions.html=${tmpFileName} --from-file=versions.json=${jsonTmpFileName}`);
}
const _buildFromSource = async (versions, args) => {
    console.log(`System version: ${versions.systemVersion}`);
    const registry = args.registry || 'docker.io/hkube';

    const baseFolderForSources = `${FOLDERS.hkube}/${versions.systemVersion}/sources`;
    for (repo of versions.versions) {
        console.log(`building ${repo.project}@${repo.tag}`);
        const repoFolder = `${baseFolderForSources}/${repo.project}`;
        await syncSpawn('npm', 'run build', { cwd: repoFolder, env: { ...process.env, PRIVATE_REGISTRY: registry } });
    }

}
const _setYamlPaths = (base) => {
    coreYamlPath = path.join(base, 'kubernetes', 'yaml.cluster', 'core');
    thirdPartyPath = path.join(base, 'kubernetes', 'yaml.cluster', 'thirdParty');
    console.log(`Using core yaml path ${coreYamlPath}`)
    console.log(`Using thirdParty yaml path ${thirdPartyPath}`)
}
const _cloneDeployment = async (versions, opts) => {
    console.log(`System version: ${versions.systemVersion}`);
    const baseFolderForSources = `${FOLDERS.hkube}/${versions.systemVersion}/sources`;
    await fs.mkdirp(baseFolderForSources);
    const deploymentRepo = versions.versions.find(v => v.project === DEPLOYMENT_REPO);
    if (!deploymentRepo) {
        console.error(`unable to find deployment repo for version ${versions.systemVersion}`);
        return false;
    }
    const repoFolder = `${baseFolderForSources}/${deploymentRepo.project}`;
    await cloneRepo(deploymentRepo.project, deploymentRepo.tag, repoFolder);
    _setYamlPaths(repoFolder);
    return true;
}

const _applyVersionsCore = async (versions, opts) => {
    console.log(`System version: ${versions.systemVersion}`);
    versions.versions.forEach(v => {
        console.log(`${v.project}:${v.tag}`)
    })
    const alreadyWritten = [];
    const yamls = fs.readdirSync(coreYamlPath);
    for (const file of yamls) {
        if (path.basename(file).startsWith('#')) {
            continue;
        }
        const { tmpFileName, images } = await changeYamlImageVersion(file, versions, coreYamlPath, opts.registry, opts.cluster_name)
        await syncSpawn('kubectl', `apply -f ${tmpFileName}`);
    }

}

const _ignoreFileFunc = (file, stats) => {
    // return stats.isDirectory() && path.extname(file) != "yml";
    return path.basename(file).startsWith('#') || (!stats.isDirectory() && path.extname(file) != ".yml");
}

const _applyVersionsThirdParty = async (versions, opts) => {
    pts = opts || [];
    const alreadyWritten = [];
    const yamlsNotSorted = await recursiveDir(thirdPartyPath, [_ignoreFileFunc]);
    const yamls = yamlsNotSorted.sort();
    for (const file of yamls) {
        try {
            if (path.basename(file).startsWith('#')) {
                continue;
            }
            if (fs.lstatSync(file).isDirectory()) {
                continue;
            }

            const { tmpFileName, images, waitObjectName } = await changeYamlImageVersion(file, null, thirdPartyPath, opts.registry,opts.cluster_name)
            await syncSpawn('kubectl', `apply -f ${tmpFileName}`);
            if (waitObjectName) {
                await kubernetesApi.listenToK8sStatus(waitObjectName, `Running`)
            }

        }
        catch (e) {
            console.error(e);
        }
    }

}
module.exports = {
    deploy
}