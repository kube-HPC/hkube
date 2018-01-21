const fs = require('fs-extra');
const path = require('path');
const { getOptionOrDefault } = require('../common/versionUtils')
const { getLatestVersions, changeYamlImageVersion, cloneRepo } = require('../common/githubHelper');
const { YAML_PATH } = require('../minikube/consts-minikube');
const { FOLDERS } = require('./../consts.js');
const syncSpawn = require('../minikube/sync-spawn');
const recursiveDir = require('recursive-readdir');
const colors = require('colors');
var dockerParse = require('dockerfile-parse')

let coreYamlPath = YAML_PATH.core;
let thirdPartyPath = YAML_PATH.thirdParty;
const DEPLOYMENT_REPO = 'deployment';
const options = {
    core: 'core',
    coreShort: 'c',
    thirdParty: 'thirdParty',
    thirdPartyShort: 't',
    source: 'source',
    sourceShort: 's',
    version: 'semver',
}
let alreadyWritten = [];

const pack = async (args) => {
    const versionPrefix = getOptionOrDefault(args, [options.version]);
    const versions = await getLatestVersions(versionPrefix);
    if (!versions) {
        console.error(`Unable to find version ${versionPrefix}`)
        return;
    }
    alreadyWritten = [];
    const versionFolder = `${FOLDERS.hkube}/${versions.systemVersion}`
    await fs.mkdirp(versionFolder);
    fs.writeFileSync(path.join(versionFolder, 'version.json'), JSON.stringify(versions, null, 2));
    // clone deployment first to get all yamls
    if (!await _cloneDeployment(versions, args)) {
        return;
    }
    for (const arg of args) {
        const key = arg[0];
        const value = arg[1];
        if (!value) {
            continue;
        }
        switch (key) {
            case options.core:
            case options.coreShort:
                await _getVersionsCore(versions, args);
                break;
            case options.thirdParty:
            case options.thirdPartyShort:
                await _getVersionsThirdParty(versions, args);
                break;
            case options.source:
            case options.sourceShort:
                await _getVersionsCoreSource(versions, args);
                break;
        }
    }
}

const _setYamlPaths = (base) => {
    coreYamlPath = path.join(base, 'kubernetes', 'yaml', 'core');
    thirdPartyPath = path.join(base, 'kubernetes', 'yaml', 'thirdParty');
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

const _getVersionsCoreSource = async (versions, opts) => {
    console.log(`System version: ${versions.systemVersion}`);
    const baseFolderForSources = `${FOLDERS.hkube}/${versions.systemVersion}/sources`;
    await fs.mkdirp(baseFolderForSources);
    for (repo of versions.versions) {
        console.log(`cloning ${repo.project}@${repo.tag}`);
        const repoFolder = `${baseFolderForSources}/${repo.project}`;
        await cloneRepo(repo.project, repo.tag, repoFolder);
        await _pullBaseImage(versions, repo.project, repoFolder);
        await syncSpawn('npm', 'i', { cwd: repoFolder });
    }
}

const _pullBaseImage = async (versions, project, repoFolder) => {
    const baseImagesFolder = `${FOLDERS.hkube}/${versions.systemVersion}/baseImages`;
    await fs.mkdirp(baseImagesFolder);

    const dockerFilePath = path.join(repoFolder, 'dockerfile', 'Dockerfile');
    if (!fs.existsSync(dockerFilePath)) {
        console.warn(`docker file for project ${project} not found. Skipping`.magenta);
        return;
    }
    const dockerfileString = fs.readFileSync(dockerFilePath, { encoding: 'utf8' });
    const dockerfile = dockerParse(dockerfileString);
    const image = dockerfile.from;
    const fileName = image.replace(/[\/:]/gi, '_')
    if (alreadyWritten.includes(fileName)) {
        console.log(`${fileName} already written. skipping.`)
        return;
    }
    alreadyWritten.push(fileName);
    await syncSpawn(`docker`, `pull ${image}`)
    await syncSpawn(`docker`, `save -o ${path.join(baseImagesFolder, fileName)}.tar ${image}`)

}
const _getVersionsCore = async (versions, opts) => {
    console.log(`System version: ${versions.systemVersion}`);
    versions.versions.forEach(v => {
        console.log(`${v.project}:${v.tag}`)
    })
    await fs.mkdirp(`${FOLDERS.hkube}/${versions.systemVersion}/images`);
    await fs.mkdirp(`${FOLDERS.hkube}/${versions.systemVersion}/yaml`);

    const yamls = fs.readdirSync(coreYamlPath);
    for (const file of yamls) {
        if (path.basename(file).startsWith('#')) {
            continue;
        }
        const { tmpFileName, images } = changeYamlImageVersion(file, versions, coreYamlPath)
        for (const i of images) {
            const fileName = i.replace(/[\/:]/gi, '_')
            if (alreadyWritten.includes(fileName)) {
                console.log(`${fileName} already written. skipping.`)
                continue;
            }
            alreadyWritten.push(fileName);
            await syncSpawn(`docker`, `pull ${i}`)
            await syncSpawn(`docker`, `save -o ${FOLDERS.hkube}/${versions.systemVersion}/images/${fileName}.tar ${i}`)

        }
        fs.copyFileSync(tmpFileName, `${FOLDERS.hkube}/${versions.systemVersion}/yaml/${path.basename(file)}`)
    }

}

const _ignoreFileFunc = (file, stats) => {
    // return stats.isDirectory() && path.extname(file) != "yml";
    return path.basename(file).startsWith('#') || (!stats.isDirectory() && path.extname(file) != ".yml");
}

const _getVersionsThirdParty = async (versions, opts) => {
    pts = opts || [];
    const thirdPartyFolder = `${FOLDERS.hkube}/${versions.systemVersion}/thirdParty`;
    await fs.mkdirp(thirdPartyFolder);
    
    const yamls = await recursiveDir(thirdPartyPath, [_ignoreFileFunc]);
    for (const file of yamls) {
        try {
            if (path.basename(file).startsWith('#')) {
                continue;
            }
            if (fs.lstatSync(file).isDirectory()) {
                continue;
            }
            const { tmpFileName, images } = changeYamlImageVersion(file, null, thirdPartyPath)
            for (const i of images) {
                const fileName = i.replace(/[\/:]/gi, '_')
                if (alreadyWritten.includes(fileName)) {
                    console.log(`${fileName} already written. skipping.`)
                    continue;
                }
                alreadyWritten.push(fileName);
                await syncSpawn(`docker`, `pull ${i}`)
                await syncSpawn(`docker`, `save -o ${path.join(thirdPartyFolder,fileName)}.tar ${i}`)

            }

        }
        catch (e) {
            console.error(e);
        }
        // fs.copyFileSync(tmpFileName, `${FOLDERS.hkube}/${path.basename(file)}`)
    }

}
module.exports = pack