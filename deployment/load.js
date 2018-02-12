import { version } from 'punycode';

const fs = require('fs-extra');
const path = require('path');
const { getOptionOrDefault } = require('../common/versionUtils')
const { getLatestVersions, changeYamlImageVersion, cloneRepo , createImageName} = require('../common/githubHelper');
const { YAML_PATH } = require('./consts');
const { FOLDERS } = require('./../consts.js');
const syncSpawn = require('../minikube/sync-spawn');
const recursiveDir = require('recursive-readdir');
const kubernetesApi = require('../minikube/kubernetes-api');

let coreYamlPath = YAML_PATH.core;
let thirdPartyPath = YAML_PATH.thirdParty;
let baseImagesPath;
let thirdPartyImagesPath;
let coreImagesPath;

const DEPLOYMENT_REPO = 'deployment';
const options = {
    core: 'c',
    thirdParty: 't',
    folder: 'folder',
    registry: 'registry',
    build: 'build'

}

const load = async (args) => {
    let versions;
    if (args.folder) {
        // set yamls from folder        
        const versionsFile = fs.readFileSync(path.join(args.folder, 'version.json'), { encoding: 'utf8' });
        versions = JSON.parse(versionsFile);
    }
    else {
        throw new Exception("folder is required for load");
    }
    if (!versions) {
        console.error(`Unable to find version ${versionPrefix}`)
        return;
    }
    console.log(`System version: ${versions.systemVersion}`);
    const baseFolderForSources = `${FOLDERS.hkube}/${versions.systemVersion}/sources`;
    const deploymentRepo = versions.versions.find(v => v.project === DEPLOYMENT_REPO);
    if (!deploymentRepo) {
        console.error(`unable to find deployment repo for version ${versions.systemVersion}`);
        return false;
    }
    const deploymentFolder = `${baseFolderForSources}/${deploymentRepo.project}`;
    _setYamlPaths(deploymentFolder);
    _setDockerImagesPaths(args.folder);

    for (const key in args) {
        const value = args[key];
        if (!value) {
            continue;
        }
        switch (key) {
            case options.core:
                await _loadCore(versions, args);
                break;
            case options.base:
                await _loadBase(versions, args);
                break;
            case options.thirdParty:
                await _loadThirdParty(versions, args);
                break;
            case options.build:
                await _buildFromSource(versions, args);
                break;
        }
    }
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

const _setDockerImagesPaths = (base) => {
    baseImagesPath = path.join(base, 'baseImages');
    thirdPartyImagesPath = path.join(base, 'thirdParty');
    coreImagesPath = path.join(base, 'images');
}

const _load = async (versions, opts, basePath) => {
    const registry = opts.registry || 'docker.io/hkube';
    const alreadyWritten = [];
    const imagesJson = fs.readFileSync(path.join(basePath,'images.json'));
    const images = JSON.parse(imagesJson);
    const tars = fs.readdirSync(basePath);
    for (const file of tars) {
        if (path.basename(file).startsWith('#')) {
            continue;
        }
        if (path.extname(file)!=='.tar'){
            continue;
        }
        const imageDetails = images.find((i)=>i.file === path.basename(file));
        await syncSpawn('docker', `load -i ${path.join(basePath,file)}`);
        if (imageDetails){
            const origImageName = createImageName(imageDetails);
            const imageNameWithRepo = createImageName({...imageDetails,registry});
            await syncSpawn('docker', `tag ${origImageName} ${imageNameWithRepo}`);
            await syncSpawn('docker', `push ${imageNameWithRepo}`);
            // console.log(`docker tag ${origImageName} ${imageNameWithRepo}`)
            // console.log(`docker push ${imageNameWithRepo}`)
        }
    }

}

const _loadBase = async (versions, opts) => {
    return _load(version,opts,baseImagesPath);
}

const _loadCore = async (versions, opts) => {
    return _load(version,opts,coreImagesPath);
}

const _loadThirdParty = async (versions, opts) => {
    return _load(version,opts,thirdPartyImagesPath);
}


const _ignoreFileFunc = (file, stats) => {
    // return stats.isDirectory() && path.extname(file) != "yml";
    return path.basename(file).startsWith('#') || (!stats.isDirectory() && path.extname(file) != ".yml");
}


module.exports = load