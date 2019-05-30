const path = require('path');
const Stream = require('stream');
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

const _writeStreamToFile = ({ readStream, src }) => {
    return new Promise((resolve, reject) => {
        if (!(readStream instanceof Stream)) {
            reject(new TypeError('data must readable stream'));
        }
        else {
            const writeStream = fse.createWriteStream(src);
            readStream.on('error', (err) => {
                reject(err);
            });
            writeStream.on('error', (err) => {
                reject(err);
            });
            writeStream.on('close', () => {
                resolve();
            });
            readStream.pipe(writeStream);
        }
    });
};

const _writeStream = async ({ buildId, src }) => {
    log.info(`getStream -> ${buildId}`, { component });
    const readStream = await storageManager.hkubeBuilds.getStream({ buildId });
    log.info(`writeStreamToFile -> ${buildId} - ${src}`, { component });
    await _writeStreamToFile({ readStream, src });
};

const _extractFile = async ({ src, dest, fileExt, overwrite }) => {
    return new Promise((resolve, reject) => { // eslint-disable-line
        log.info(`extracting ${src} -> ${dest} - ext ${fileExt}`, { component });

        switch (fileExt) {
            case 'zip': {
                const zip = new Zip(src);
                zip.extractAllTo(dest, overwrite);
                return resolve();
            }
            case 'gz': {
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
};

const _runBash = ({ command, args }) => {
    return new Promise((resolve, reject) => {
        log.info(`running ${command}`, { component });
        const build = spawn(command, args);
        let data = '';
        let error = '';

        build.stdout.on('data', (d) => {
            data += d.toString();
        });
        build.stderr.on('data', (d) => {
            error += d.toString();
        });
        build.on('close', () => {
            return resolve({ data, error });
        });
        build.on('error', (err) => {
            return reject(err);
        });
    });
};

const _setBuildStatus = async (options) => {
    const { buildId, status, error } = options;
    log.info(`update build status to: ${status} -> ${buildId}. ${error || ''}`, { component });
    await stateManger.updateBuild({ timestamp: Date.now(), ...options });
};

const _updateAlgorithmImage = async ({ algorithmName, algorithmImage, status }) => {
    if (status === States.COMPLETED) {
        log.info(`update algorithm image, name=${algorithmName}, image=${algorithmImage}`, { component });
        await stateManger.updateAlgorithmImage({ algorithmName, algorithmImage });
    }
};

const _getBuild = async ({ buildId }) => {
    log.info(`getBuild -> ${buildId}`, { component });
    const build = await stateManger.getBuild({ buildId });
    if (!build) {
        throw new Error(`unable to find build -> ${buildId}`);
    }
    return build;
};

const _downloadFile = async ({ buildId, src, dest, fileExt, overwrite }) => {
    await _writeStream({ buildId, src });
    await _extractFile({ src, dest, fileExt, overwrite });
    await fse.remove(src);
};

const _prepareBuild = async ({ buildPath, env, dest, overwrite }) => {
    const envr = `environments/${env}`;
    await fse.ensureDir(buildPath);
    await fse.copy(envr, buildPath);
    await fse.move(dest, `${buildPath}/algorithm_unique_folder`, { overwrite });
};

const _removeFolder = async ({ folder }) => {
    if (folder) {
        await fse.remove(folder);
    }
};

const _buildDocker = async ({ docker, algorithmName, version, buildPath }) => {
    const baseImage = path.join(docker.registry, docker.namespace, algorithmName);
    const algorithmImage = `${baseImage}:v${version}`;
    const args = [algorithmImage, docker.registry, docker.user, docker.pass, buildPath];
    const output = await _runBash({ command: `${process.cwd()}/lib/builds/build-algorithm-image.sh`, args });
    return { output, algorithmImage };
};

const _isWarning = (error) => {
    const e = error.toLowerCase();
    return e.includes('warn') || e.includes('docs.docker.com');
};

const _analyzeErrors = (output, error) => {
    if (error) {
        return { data: output.data, errors: error };
    }
    return _analyzeError(output);
};

const _analyzeError = (output) => {
    const e = output.error || '';
    const error = e.replace(/^\s*[\r\n]/gm, '').split('\n');
    const warnings = error.filter(e => _isWarning(e)).join(',');
    const errors = error.filter(e => !_isWarning(e)).join(',');
    return { data: output.data, warnings, errors };
};

const runBuild = async (options) => {
    let build;
    let buildPath;
    let error;
    let trace;
    let buildId;
    let algorithmName;
    let result = { output: {} };

    try {
        buildId = options.buildId;
        if (!buildId) {
            throw new Error('build id is required');
        }
        log.info(`build started -> ${buildId}`, { component });
        build = await _getBuild({ buildId });
        await _setBuildStatus({ buildId, progress: 10, status: States.ACTIVE });

        const overwrite = true;
        const { env, version, fileExt } = build;
        const { docker, buildDirs } = options;
        algorithmName = build.algorithmName;
        const src = `${buildDirs.ZIP}/${algorithmName}`;
        const dest = `${buildDirs.UNZIP}/${algorithmName}`;
        buildPath = `builds/${env}/${algorithmName}`;

        log.info(`starting build for algorithm=${algorithmName}, version=${version}, env=${env} -> ${buildId}`, { component });

        await _ensureDirs(buildDirs);
        await _setBuildStatus({ buildId, progress: 30, status: States.ACTIVE });
        await _downloadFile({ buildId, src, dest, fileExt, overwrite });
        await _prepareBuild({ buildPath, env, dest, overwrite });
        await _setBuildStatus({ buildId, progress: 50, status: States.ACTIVE });
        result = await _buildDocker({ docker, algorithmName, version, buildPath });
    }
    catch (e) {
        error = e.message;
        trace = e.stack;
        log.error(e.message, { component }, e);
    }

    // result.output.error = "WARNING! Your password will be stored unencrypted in /root/.docker/config.json.
    // Configure a credential helper to remove this warning. 
    // See https://docs.docker.com/engine/reference/commandline/login/#credentials-store

    //The command '/bin/sh -c docker/requirements.sh' returned a non-zero code: 1\n
    //An image does not exist locally with the tag: hkube/ccc\n";

    const { data, warnings, errors } = _analyzeErrors(result.output, error);

    await _removeFolder({ folder: buildPath });
    const status = errors ? States.FAILED : States.COMPLETED;
    const progress = error ? 80 : 100;
    await _updateAlgorithmImage({ algorithmName, algorithmImage: result.algorithmImage, status });
    await _setBuildStatus({ buildId, progress, error, trace, status, endTime: Date.now(), result: { data, warnings, errors } });
    return { buildId, error, status, result };
};

module.exports = runBuild;
