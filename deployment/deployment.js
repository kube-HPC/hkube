const fs = require('fs-extra');
const path = require('path');
const { getOptionOrDefault } = require('../common/versionUtils')
const { getLatestVersions, changeYamlImageVersion } = require('../common/githubHelper');
const { YAML_PATH } = require('../minikube/consts-minikube');
const { FOLDERS } = require('./../consts.js');
const syncSpawn = require('../minikube/sync-spawn');

let coreYamlPath = YAML_PATH.core;
let thirdPartyPath = YAML_PATH.thirdParty;
const options = {
    core: 'core',
    coreShort: 'c',
    thirdParty: 'thirdParty',
    thirdPartyShort: 't'
}

const _deployment = async (opt) => {
    switch (opt[0][0]) {
        case options.core:
        case options.coreShort:
            return _getVersionsCore(opt);
        case options.thirdParty:
        case options.thirdPartyShort:
            return _getVersionsThirdParty(opt);
        default:
            console.error('Unknown deployment options');
    }

}

const _getVersionsCore = async (opts) => {
    pts = opts || [];
    const versionPrefix = getOptionOrDefault(opts, [options.versions, options.versionsShort]);
    const versions = await getLatestVersions(versionPrefix);
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
        const { tmpFileName, images } = changeYamlImageVersion(file, versions, coreYamlPath)
        for (const i of images) {
            const fileName = i.replace(/[\/:]/gi, '_')
            if (alreadyWritten.includes(fileName)) {
                console.log(`${fileName} already written. skipping.`)
                continue;
            }
            alreadyWritten.push(fileName);
            await syncSpawn(`docker`, `pull ${i}`)
            await fs.mkdirp(`${FOLDERS.hkube}/core`);
            await syncSpawn(`docker`, `save -o ${FOLDERS.hkube}/core/${fileName}.tar ${i}`)

        }
        fs.copyFileSync(tmpFileName, `${FOLDERS.hkube}/${path.basename(file)}`)
    }

}
const _getVersionsThirdParty = async (opts) => {
    pts = opts || [];
    const alreadyWritten = [];
    const yamls = fs.readdirSync(thirdPartyPath);
    for (const file of yamls) {
        try {
            if (path.basename(file).startsWith('#')) {
                continue;
            }
            if (fs.lstatSync(`${thirdPartyPath}/${file}`).isDirectory()){
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
                await fs.mkdirp(`${FOLDERS.hkube}/thirdParty`);
                await syncSpawn(`docker`, `save -o ${FOLDERS.hkube}/thirdParty/${fileName}.tar ${i}`)

            }

        }
        catch (e) {
            console.error(e);
        }
        // fs.copyFileSync(tmpFileName, `${FOLDERS.hkube}/${path.basename(file)}`)
    }

}
module.exports = _deployment