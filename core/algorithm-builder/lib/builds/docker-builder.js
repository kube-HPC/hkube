const path = require('path');
const Stream = require('stream');
const fse = require('fs-extra');
const Zip = require('adm-zip');
const targz = require('targz');
const { spawn } = require('child_process');
const { parseImageName } = require('@hkube/kubernetes-client').utils;
const storageManager = require('@hkube/storage-manager');
const log = require('@hkube/logger').GetLogFromContainer();
const { STATES, PROGRESS } = require('../consts/States');
const component = require('../consts/components').DOCKER_BUILDER;
const { KANIKO } = require('../consts/buildModes');
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
        build.on('close', (code) => {
            if (code) {
                error += `Exit with code ${code}`;
            }
            return resolve({ data, error, code });
        });
        build.on('error', (err) => {
            return reject(err);
        });
    });
};

const _setBuildStatus = async (options) => {
    const { buildId, status, error, progress } = options;
    const prog = progress(status);
    log.info(`update build status to: ${status}, progress: ${prog}  -> ${buildId}. ${error || ''}`, { component });
    await stateManger.updateBuild({ timestamp: Date.now(), progress: prog, ...options });
};

const _updateAlgorithmImage = async ({ algorithmName, algorithmImage, status }) => {
    if (status === STATES.COMPLETED) {
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

const _argsHelper = (args, key, value) => {
    if (value) {
        args.push(key);
        args.push(value);
    }
    return args;
};

const _dockerCredentialsHelper = (registryOrig, user, password) => {
    log.info('creating docker creds');
    if (!user || !password) {
        return null;
    }
    const dockerHubRegistry = 'https://index.docker.io/v1/';
    let registry = registryOrig;
    if (!registry || registry.includes('docker.io')) {
        log.info(`found docker hub. using ${dockerHubRegistry}`);
        registry = dockerHubRegistry;
    }
    const auth = Buffer.from(`${user}:${password}`).toString('base64');
    return { registry, auth };
};

const _createDockerCredentials = (pullRegistry, pushRegistry) => {
    const creds = {
        auths: {

        }
    };
    if (pullRegistry) {
        const auth = _dockerCredentialsHelper(pullRegistry.registry, pullRegistry.user, pullRegistry.pass);
        if (auth) {
            creds.auths[auth.registry] = auth.auth;
        }
    }
    if (pushRegistry) {
        const auth = _dockerCredentialsHelper(pushRegistry.registry, pushRegistry.user, pushRegistry.pass);
        if (auth) {
            creds.auths[auth.registry] = { auth: auth.auth };
        }
    }
    return creds;
};

const _getBaseImageVersion = async (env) => {
    const data = await fse.readFile(`${process.cwd()}/lib/builds/base-versions`, 'utf8');
    const splitted = data.split('\n');
    const obj = Object.create(null);
    splitted.forEach((s) => {
        const line = s.split('=');
        obj[line[0]] = line[1];
    });
    const baseVersion = obj[env];
    if (!baseVersion) {
        throw new Error(`unable to find base version for ${env} env`);
    }
    return baseVersion;
};

const _fixUrl = (url) => {
    return url.replace(/\/+$/, '');
};

const _createURL = (options) => {
    return path.join(_fixUrl(options.registry), options.namespace).replace(/\s/g, '');
};

function resolveBaseImage(baseImage, registry) {
    if (!baseImage) {
        return null;
    }
    let baseImageName;
    const parsedBaseImage = parseImageName(baseImage);
    if (parsedBaseImage) {
        baseImageName = parsedBaseImage.name;
        if (!parsedBaseImage.registry) {
            baseImageName = path.join(registry, baseImageName);
        }
    }
    return baseImageName;
}

const buildAlgorithmImage = async ({ buildMode, env, docker, algorithmName, version, buildPath, rmi, baseImage, tmpFolder, packagesRepo }) => {
    const pullRegistry = _createURL(docker.pull);
    const pushRegistry = _createURL(docker.push);
    const algorithmImage = `${path.join(pushRegistry, algorithmName)}:v${version}`;
    const baseVersion = await _getBaseImageVersion(env);
    const packages = packagesRepo[env];
    const baseImageName = resolveBaseImage(baseImage, docker.pull.registry);
    const defaultBaseImage = `${pullRegistry}/base-algorithm-${env}:${baseVersion}`;

    const args = [
        '--img', algorithmImage,
        '--rmi', rmi,
        '--buildPath', buildPath,
        '--baseImage', baseImageName || defaultBaseImage
    ];

    // docker pull
    _argsHelper(args, '--dplr', pullRegistry);
    _argsHelper(args, '--dplu', docker.pull.user);
    _argsHelper(args, '--dplp', docker.pull.pass);

    // docker push
    _argsHelper(args, '--dphr', pushRegistry);
    _argsHelper(args, '--dphu', docker.push.user);
    _argsHelper(args, '--dphp', docker.push.pass);

    // packages
    _argsHelper(args, '--pckr', packages.registry);
    _argsHelper(args, '--pckt', packages.token);

    if (buildMode === KANIKO) {
        _argsHelper(args, '--tmpFolder', tmpFolder);
        const dockerCreds = _createDockerCredentials(docker.pull, docker.push);
        await fse.writeJson(path.join(tmpFolder, 'commands', 'config.json'), dockerCreds, { spaces: 2 });
    }

    const output = await _runBash({ command: `${process.cwd()}/lib/builds/build-algorithm-image-${buildMode}.sh`, args });
    return { output, algorithmImage };
};

const _isWarning = (error) => {
    const e = error.toLowerCase();
    return e.includes('warn') || e.includes('docs.docker.com');
};

const _analyzeError = (output) => {
    const err = output.error || '';
    const error = err.replace(/^\s*[\r\n]/gm, '').split('\n');
    const warnings = error.filter(e => _isWarning(e)).join(',');
    const errors = error.filter(e => !_isWarning(e)).join(',');
    return { data: output.data, warnings, errors };
};

const _analyzeErrors = (output, error) => {
    if (error) {
        return { data: output.data, errors: error };
    }
    return _analyzeError(output);
};

const _progress = (progress) => {
    let prog = progress;
    return (status) => {
        if (status === STATES.ACTIVE) {
            prog += PROGRESS[status];
        }
        else {
            prog = PROGRESS[status];
        }
        return prog;
    };
};

const runBuild = async (options) => {
    let build;
    let buildPath;
    let error;
    let trace;
    let buildId;
    let algorithmName;
    let result = { output: {} };
    const progress = _progress(0);

    try {
        buildId = options.buildId;
        if (!buildId) {
            throw new Error('build id is required');
        }
        log.info(`build started -> ${buildId}`, { component });
        build = await _getBuild({ buildId });
        await _setBuildStatus({ buildId, progress, status: STATES.ACTIVE });

        const overwrite = true;
        const { env, version, fileExt, baseImage } = build;
        const { docker, buildDirs, buildMode, tmpFolder, packagesRepo } = options;
        algorithmName = build.algorithmName;
        const src = `${buildDirs.ZIP}/${algorithmName}`;
        const dest = `${buildDirs.UNZIP}/${algorithmName}`;
        buildPath = `builds/${env}/${algorithmName}`;

        log.info(`starting build for algorithm=${algorithmName}, version=${version}, env=${env} -> ${buildId}`, { component });

        await _ensureDirs(buildDirs);
        await _setBuildStatus({ buildId, progress, status: STATES.ACTIVE });
        await _downloadFile({ buildId, src, dest, fileExt, overwrite });
        await _prepareBuild({ buildPath, env, dest, overwrite });
        await _setBuildStatus({ buildId, progress, status: STATES.ACTIVE });
        result = await buildAlgorithmImage({ buildMode, env, docker, algorithmName, version, buildPath, rmi: 'True', baseImage, tmpFolder, packagesRepo });
    }
    catch (e) {
        error = e.message;
        trace = e.stack;
        log.error(e.message, { component }, e);
    }

    const { data, warnings, errors } = _analyzeErrors(result.output, error);
    await _removeFolder({ folder: buildPath });
    const status = errors ? STATES.FAILED : STATES.COMPLETED;
    await _updateAlgorithmImage({ algorithmName, algorithmImage: result.algorithmImage, status });
    await _setBuildStatus({ buildId, progress, error, trace, status, endTime: Date.now(), result: { data, warnings, errors } });
    return { buildId, error, status, result: { data, warnings, errors } };
};

module.exports = {
    runBuild,
    buildAlgorithmImage
};


