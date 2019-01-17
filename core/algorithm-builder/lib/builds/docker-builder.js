const path = require('path');
const Zip = require('adm-zip');
const targz = require('targz');
const fse = require('fs-extra');
const { spawn } = require('child_process');
const Logger = require('@hkube/logger');
const component = require('../consts/components').OPERATOR;
const log = Logger.GetLogFromContainer();

const build = async (options) => {
    let errorMsg;
    let resultData;
    let imageName;
    const filesToRemove = [];
    try {
        const overwrite = true;
        const { payload, src, docker, deleteSrc } = options;
        const { algorithm, version } = payload;
        const { name, env, code } = algorithm;

        if (deleteSrc) {
            filesToRemove.push(src);
        }

        const envr = `environments/${env}`;
        const dest = `uploads/unzipped/${name}`;
        const buildPath = `builds/${env}/${name}`;
        filesToRemove.push(buildPath);

        await _extractFile({ src, dest, fileExt: code.fileExt, overwrite });

        await fse.ensureDir(buildPath);
        await fse.copy(envr, buildPath);
        await fse.move(dest, `${buildPath}/algorithm`, { overwrite });

        const image = path.join(docker.registry, docker.namespace, name);
        imageName = `${image}:v${version}`;
        const args = [imageName, docker.registry, docker.user, docker.pass, buildPath];
        resultData = await _runBash({ command: `${process.cwd()}/lib/builds/build.sh`, args });
    }
    catch (e) {
        errorMsg = e.message;
        log.error(e.message, { component });
    }
    finally {
        await _removeFiles({ files: filesToRemove });
    }
    return { errorMsg, resultData, imageName };
}

const _extractFile = async ({ src, dest, fileExt, overwrite }) => {
    return new Promise((resolve, reject) => {
        switch (fileExt) {
            case '.zip': {
                const zip = new Zip(src);
                zip.extractAllTo(dest, overwrite);
                return resolve();
            }
            case '.gz': {
                targz.decompress({ src, dest }, (err) => {
                    if (err) {
                        return reject(err);
                    }
                    return resolve();
                });
                break;
            }
            default:
                return reject(new Error(`unsupported file type ${fileExt}`));
        }
    });
}

const _runBash = ({ command, args }) => {
    return new Promise((resolve, reject) => {
        const build = spawn(command, args);
        let result = '';
        let error = '';

        build.stdout.on('data', (data) => {
            result += data.toString();
        });
        build.stderr.on('data', (data) => {
            error += data.toString();
        });
        build.on('close', (code) => {
            if (error) {
                return reject(error);
            }
            return resolve(result);
        });
        build.on('error', (err) => {
            return reject(err);
        });
    });
}

const _removeFiles = async ({ files }) => {
    await Promise.all(files.map((f) => fse.remove(f)));
}

module.exports = build;
