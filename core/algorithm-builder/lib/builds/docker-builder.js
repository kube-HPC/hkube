const path = require('path');
const readChunk = require('read-chunk');
const fileType = require('file-type');
const fse = require('fs-extra');
const Zip = require('adm-zip');
const targz = require('targz');
const { spawn } = require('child_process');
const storageManager = require('@hkube/storage-manager');
const log = require('@hkube/logger').GetLogFromContainer();
const States = require('../consts/States');
const component = require('../consts/components').DOCKER_BUILDER;
const stateManger = require('../state/state-manager');

const _ensureDirs = async (dirs) => {
    await Promise.all(Object.values(dirs).map(d => fse.ensureDir(d)));
};

const _writeStreamToFile = ({ readStream, srcFile }) => {
    return new Promise((resolve, reject) => {
        const writeStream = fse.createWriteStream(srcFile);
        readStream.on('error', (err) => {
            return reject(err);
        });
        writeStream.on('error', (err) => {
            return reject(err);
        });
        writeStream.on('close', () => {
            return resolve();
        });
        readStream.pipe(writeStream);
    });
};

const _writeStream = async ({ buildId, srcFile }) => {
    log.info(`getStream -> ${buildId}`, { component });
    const readStream = await storageManager.hkubeBuilds.getStream({ buildId });
    log.info(`writeStreamToFile -> ${buildId} - ${srcFile}`, { component });
    await _writeStreamToFile({ readStream, srcFile });
};

const _extractFile = async ({ srcFile, dest, overwrite }) => {
    return new Promise((resolve, reject) => {
        const buffer = readChunk.sync(srcFile, 0, fileType.minimumBytes);
        const type = fileType(buffer);
        log.info(`extracting ${srcFile} -> ${dest} - ext ${type.ext}`, { component });

        switch (type.ext) {
            case 'zip': {
                const zip = new Zip(srcFile);
                zip.extractAllTo(dest, overwrite);
                return resolve();
            }
            case 'gz': {
                targz.decompress({ src: srcFile, dest }, (err) => {
                    if (err) {
                        return reject(err);
                    }
                    return resolve();
                });
                break;
            }
            default:
                return reject(new Error(`unsupported file type ${type.ext}`));
        }
    });
};

const _realError = (error) => {
    return error && error.indexOf('WARNING') === -1;
};

const _runBash = ({ command, args }) => {
    return new Promise((resolve, reject) => {
        log.info(`running ${command}`, { component });
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
            if (_realError(error)) {
                return reject(new Error(error));
            }
            return resolve(result);
        });
        build.on('error', (err) => {
            return reject(err);
        });
    });
};

const _setBuildStatus = async ({ buildId, error, status, result }) => {
    log.info(`setBuild ${status} -> ${buildId}. ${error || ''}`, { component });
    await stateManger.setBuild({ buildId, timestamp: new Date(), status, result, error });
};

const _updateAlgorithmImage = async ({ algorithmName, algorithmImage }) => {
    await stateManger.updateAlgorithmImage({ algorithmName, algorithmImage });
};

const _getBuild = async ({ buildId }) => {
    const build = await stateManger.getBuild({ buildId });
    if (!build) {
        throw new Error(`unable to find build -> ${buildId}`);
    }
    return build;
};

const _downloadFile = async ({ buildId, srcFile, dest, overwrite }) => {
    await _writeStream({ buildId, srcFile });
    await _extractFile({ srcFile, dest, overwrite });
    await fse.remove(srcFile);
};

const _prepareBuild = async ({ buildPath, env, dest, overwrite }) => {
    const envr = `environments/${env}`;
    await fse.ensureDir(buildPath);
    await fse.copy(envr, buildPath);
    await fse.move(dest, `${buildPath}/algorithm`, { overwrite });
};

const _buildDocker = async ({ docker, algorithmName, version, buildPath }) => {
    const baseImage = path.join(docker.registry, docker.namespace, algorithmName);
    const algorithmImage = `${baseImage}:v${version}`;
    const args = [algorithmImage, docker.registry, docker.user, docker.pass, buildPath];
    const output = await _runBash({ command: `${process.cwd()}/lib/builds/build.sh`, args });
    return { output, algorithmImage };
};

const _removeFolder = async ({ folder }) => {
    if (folder) {
        await fse.remove(folder);
    }
};

const build = async (options) => {
    let build;
    let buildPath;
    let algorithmName;
    let error;
    let buildId;
    let result = {};

    try {
        buildId = options.buildId;
        if (!buildId) {
            throw new Error('build id is required');
        }
        log.info(`build started -> ${buildId}`, { component });
        build = await _getBuild({ buildId });

        const overwrite = true;
        const { algorithm, version } = build;
        const { env, name } = algorithm;
        const { docker, buildDirs } = options;
        algorithmName = name;
        const srcFile = `${buildDirs.ZIP}/${algorithmName}`;
        const dest = `${buildDirs.UNZIP}/${algorithmName}`;
        buildPath = `builds/${env}/${algorithmName}`;

        log.info(`starting build for algorithm=${algorithmName}, version=${version}, env=${env} -> ${buildId}`, { component });
        await _ensureDirs(buildDirs);
        await _setBuildStatus({ buildId, status: States.ACTIVE });
        await _downloadFile({ buildId, srcFile, srcFile, dest, overwrite });
        await _prepareBuild({ buildPath, env, dest, overwrite });
        result = await _buildDocker({ docker, algorithmName, version, buildPath });
    }
    catch (e) {
        error = e.message;
        log.error(e.message, { component }, e);
    }
    finally {
        await _removeFolder({ folder: buildPath });
        const status = error ? States.FAILED : States.COMPLETED;
        await _setBuildStatus({ buildId, error, status, result: result.output });
        await _updateAlgorithmImage({ algorithmName, algorithmImage: result.algorithmImage });
        return { buildId, error, status, result: result.output };
    }
};

module.exports = build;
