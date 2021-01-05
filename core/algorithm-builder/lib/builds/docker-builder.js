const path = require('path');
const urlLib = require('url');
const Stream = require('stream');
const { promisify } = require('util');
const fse = require('fs-extra');
const Zip = require('adm-zip');
const targz = require('targz');
const _clone = require('git-clone');
const { spawn } = require('child_process');
const { buildTypes, buildStatuses } = require('@hkube/consts');
const storageManager = require('@hkube/storage-manager');
const log = require('@hkube/logger').GetLogFromContainer();
const jsyaml = require('js-yaml');
const { STATES, PROGRESS } = require('../consts/States');
const component = require('../consts/components').DOCKER_BUILDER;
const { KANIKO, OPENSHIFT } = require('../consts/buildModes');
const stateManger = require('../state/state-manager');
const kubernetes = require('../helpers/kubernetes');
let isStopped = false;

const wrapperVersions = {
    nodejs: {
        file: 'package.json',
        parse: (file) => {
            const parsed = JSON.parse(file);
            return parsed.dependencies['@hkube/nodejs-wrapper']
        },
        override: async (file, version) => {
            try {
                const content = await fse.readJSON(file);
                content.dependencies['@hkube/nodejs-wrapper'] = version;
                await fse.writeJSON(file, content);
            } catch (error) {
                log.error(`unable to override version. Error: ${error.message}`, { component })
            }
        }
    },
    python: {
        file: 'requirements.txt',
        parse: (file) => {
            const reg = /([a-z]\w*)==\s*([^;]*)/g
            const firstLine = file.split('\n')[0];
            const res = reg.exec(firstLine);
            return res[2];
        },
        override: async (file, version) => {
            try {
                const content = await fse.readFile(file, 'utf8');
                const regex = /(hkube-python-wrapper[=>]=)(.*)/
                const replaced = content.replace(regex, `$1${version}`)
                await fse.writeFile(file, replaced);
            } catch (error) {
                log.error(`unable to override version. Error: ${error.message}`, { component })
            }
        }

    },
    java: {
        file: 'version.txt',
        parse: (file) => {
            return file;
        },
        override: async (file, version) => {
            await fse.writeFile(file, version);
        }
    }
}

const gitClone = promisify(_clone);

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

const _writeStream = async ({ buildId, filePath, src }) => {
    log.info(`getStream -> ${buildId}`, { component });
    const readStream = await storageManager.getStream({ path: filePath });
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

const runBash = ({ command, envs, resultUpdater = () => { } }) => {
    return new Promise((resolve, reject) => {
        log.info(`running ${command}`, { component });
        const build = spawn(command, [], { env: { ...process.env, ...envs } });
        let data = '';
        let error = '';

        build.stdout.on('data', async (d) => {
            if (isStopped) {
                return reject(new Error('build has stopped during build process'));
            }
            data += d.toString();
            await resultUpdater({ data });
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
    if (isStopped) {
        return;
    }
    const { buildId, status, error, progress } = options;
    const prog = progress(status);
    log.info(`update build status to: ${status}, progress: ${prog}  -> ${buildId}. ${error || ''}`, { component });
    await stateManger.updateBuild({ ...options, timestamp: Date.now(), progress: prog });
};

const _watchBuild = async ({ buildId }) => {
    log.info(`watch build -> ${buildId}`, { component });
    stateManger.on(`build-${buildStatuses.STOPPED}`, () => { isStopped = true; });
    const build = await stateManger.watchBuild({ buildId });
    if (!build) {
        throw new Error(`unable to find build -> ${buildId}`);
    }
    return build;
};

const _downloadFile = async ({ buildId, filePath, src, dest, fileExt, overwrite }) => {
    await _writeStream({ buildId, filePath, src });
    await _extractFile({ src, dest, fileExt, overwrite });
    await fse.remove(src);
};

const _parseGitUrl = (url) => {
    const parsedUrl = urlLib.parse(url);
    const [, owner, repo] = parsedUrl.pathname.split('/');
    return {
        owner,
        repo,
        protocol: parsedUrl.protocol,
        host: parsedUrl.hostname
    };
};

const _createGitTokenUrl = ({ url, token, kind }) => {
    const { protocol, host, owner, repo } = _parseGitUrl(url);
    let gitToken = token;
    if (kind === 'gitlab') {
        gitToken = `gitlab-ci-token:${token}`;
    }
    return `${protocol}//${gitToken}@${host}/${owner}/${repo}`;
};

const _downloadFromGit = async ({ dest, gitRepository }) => {
    const { cloneUrl, token, commit } = gitRepository;
    let gitUrl = cloneUrl;
    if (token) {
        gitUrl = _createGitTokenUrl({ url: gitUrl, token, kind: gitRepository.gitKind });
    }
    await gitClone(gitUrl, dest, { checkout: commit.id });
};

const _prepareBuild = async ({ buildPath, env, dest, overwrite }) => {
    const envr = `environments/${env}`;
    await fse.ensureDir(buildPath);
    await fse.copy(envr, buildPath);
    await fse.copy('environments/common', buildPath);
    await fse.move(dest, `${buildPath}/algorithm_unique_folder`, { overwrite });
};

const _removeFolder = async ({ folder }) => {
    if (folder) {
        await fse.remove(folder);
    }
};

const _envsHelper = (envs, key, value) => {
    if (value) {
        envs[key] = `${value}`;
    }
    return envs;
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
            creds.auths[auth.registry] = { auth: auth.auth };
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

const _getBaseImageVersion = async (baseImage) => {
    const imageName = await kubernetes.createImageName(baseImage);
    if (!imageName) {
        throw new Error(`unable to find base version for ${baseImage} env`);
    }
    return imageName;
};

const _getWrapperVersion = async (env, version) => {
    if (version) {
        return version
    }
    let wrapperVersion = '';
    try {
        const wrapper = wrapperVersions[env];
        const file = await fse.readFile(`environments/${env}/wrapper/${wrapper.file}`, 'utf8');
        wrapperVersion = wrapper.parse(file);
    }
    catch (error) {
        log.error(error.message, { component });
    }
    return wrapperVersion;
};

const _fixUrl = (url) => {
    return url.replace(/\/+$/, '');
};

const _createURL = (options) => {
    return path.join(_fixUrl(options.registry), options.namespace).replace(/\s/g, '');
};

const _createDockerCredsConfig = (envs, docker, packages) => {
    const pullRegistry = _createURL(docker.pull);
    const pushRegistry = _createURL(docker.push);
    _envsHelper(envs, 'DOCKER_PULL_REGISTRY_USER', docker.pull.registry);
    _envsHelper(envs, 'DOCKER_PULL_REGISTRY', pullRegistry);
    _envsHelper(envs, 'DOCKER_PULL_USER', docker.pull.user);
    _envsHelper(envs, 'DOCKER_PULL_PASS', docker.pull.pass);
    // docker push
    _envsHelper(envs, 'DOCKER_PUSH_REGISTRY', pushRegistry);
    _envsHelper(envs, 'DOCKER_PUSH_USER', docker.push.user);
    _envsHelper(envs, 'DOCKER_PUSH_PASS', docker.push.pass);
    // packages
    _envsHelper(envs, 'PACKAGES_REGISTRY', packages.registry);
    _envsHelper(envs, 'PACKAGES_REGISTRY_USER', packages.user);
    _envsHelper(envs, 'PACKAGES_TOKEN', packages.token);
    _envsHelper(envs, 'PACKAGES_AUTH', Buffer.from(packages.auth || '').toString('base64'));
}

const _createKanikoConfigs = async (envs, tmpFolder, docker) => {
    _envsHelper(envs, 'TMP_FOLDER', tmpFolder);
    const dockerCreds = _createDockerCredentials(docker.pull, docker.push);
    await fse.writeJson(path.join(tmpFolder, 'commands', 'config.json'), dockerCreds, { spaces: 2 });
    _envsHelper(envs, 'INSECURE_PULL', docker.pull.insecure);
    _envsHelper(envs, 'INSECURE', docker.push.insecure);
    _envsHelper(envs, 'SKIP_TLS_VERIFY_PULL', docker.pull.skip_tls_verify);
    _envsHelper(envs, 'SKIP_TLS_VERIFY', docker.push.skip_tls_verify);
}

const _createOpenshiftConfigs = async (envs, tmpFolder, docker, buildId, algorithmImage) => {
    _envsHelper(envs, 'TMP_FOLDER', tmpFolder);
    const dockerCreds = _createDockerCredentials(docker.pull, docker.push);
    const dockerCredsSecret = {
        apiVersion: 'v1',
        data: {
            '.dockerconfigjson': `${Buffer.from(JSON.stringify(dockerCreds)).toString('base64')}`
        },
        kind: 'Secret',
        metadata: {
            name: 'build-registry-secret',
        },
        type: 'kubernetes.io/dockerconfigjson'
    };
    const dockerCredsSecretYaml = jsyaml.dump(dockerCredsSecret);
    await fse.writeFile(path.join(tmpFolder, 'commands', 'dockerCredsSecret.yaml'), dockerCredsSecretYaml);
    const buildConf = {
        apiVersion: 'build.openshift.io/v1',
        kind: 'BuildConfig',
        metadata: {
            name: buildId,
        },
        spec: {
            source: {
                binary: {},
                type: "Binary"
            },
            output: {
                to: {
                    kind: 'DockerImage',
                    name: algorithmImage
                }
            },
            strategy: {
                dockerStrategy: {
                    dockerfilePath: './dockerfile/Dockerfile',
                    pullSecret: {
                        name: 'build-registry-secret'
                    }
                },
                type: 'Docker'
            }
        }
    };
    const buildConfYaml = jsyaml.dump(buildConf);
    await fse.writeFile(path.join(tmpFolder, 'commands', 'buildConfig.yaml'), buildConfYaml);
}

const _overrideVersion = async (env, buildPath, version) => {
    if (version) {
        const wrapper = wrapperVersions[env];
        await wrapper.override(path.join(buildPath, 'wrapper', wrapper.file), version);
    }
}

const buildAlgorithmImage = async ({ buildMode, env, docker, algorithmName, imageTag, buildPath, rmi, baseImage, tmpFolder, packagesRepo, buildId, dependencyInstallCmd }) => {
    const pushRegistry = _createURL(docker.push);
    const algorithmImage = `${path.join(pushRegistry, algorithmName)}:v${imageTag}`;
    const packages = packagesRepo[env];
    const wrapperVersion = await _getWrapperVersion(env, packages.wrapperVersion);
    await _overrideVersion(env, buildPath, wrapperVersion)
    const baseImageName = await _getBaseImageVersion(baseImage || packages.defaultBaseImage);
    const envs = {};
    _envsHelper(envs, 'IMAGE_NAME', algorithmImage);
    _envsHelper(envs, 'REMOVE_IMAGE', rmi);
    _envsHelper(envs, 'BUILD_PATH', buildPath);
    _envsHelper(envs, 'BASE_IMAGE', baseImageName);
    _envsHelper(envs, 'DEPENDENCY_INSTALL_CMD', dependencyInstallCmd);
    _envsHelper(envs, 'BUILD_ID', buildId);
    _envsHelper(envs, 'WRAPPER_VERSION', wrapperVersion);

    // docker pull
    _createDockerCredsConfig(envs, docker, packages);
    _envsHelper(envs, 'javaWrapperVersion', '2.0-SNAPSHOT');
    if (buildMode === KANIKO) {
        await _createKanikoConfigs(envs, tmpFolder, docker);
    }
    else if (buildMode === OPENSHIFT) {
        await _createOpenshiftConfigs(envs, tmpFolder, docker, buildId, algorithmImage);
    }
    let updating = false
    const resultUpdater = async (result) => {
        if (updating) {
            return;
        }
        updating = true;
        await stateManger.updateBuild({ buildId, result, timestamp: Date.now() });
        updating = false;
    }
    const output = await runBash({ command: `${process.cwd()}/lib/builds/build-algorithm-image-${buildMode}.sh`, envs, resultUpdater });
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
    let buildMode;
    let result = { output: {} };
    const progress = _progress(0);

    try {
        buildId = options.buildId;
        if (!buildId) {
            throw new Error('build id is required');
        }
        log.info(`build started -> ${buildId}`, { component });
        build = await _watchBuild({ buildId });
        if (build.status === buildStatuses.STOPPED) {
            throw new Error('build has stopped before build process');
        }
        await _setBuildStatus({ buildId, progress, status: STATES.ACTIVE });

        const overwrite = true;
        const { env, imageTag, fileExt, filePath, baseImage, type, gitRepository, dependencyInstallCmd } = build;
        const { docker, buildDirs, tmpFolder, packagesRepo } = options;
        buildMode = options.buildMode;
        algorithmName = build.algorithmName;
        const src = `${buildDirs.ZIP}/${algorithmName}`;
        const dest = `${buildDirs.UNZIP}/${algorithmName}`;
        buildPath = `builds/${env}/${algorithmName}`;

        log.info(`starting build for algorithm=${algorithmName}, imageTag=${imageTag}, env=${env} -> ${buildId}`, { component });

        await _ensureDirs(buildDirs);
        await _setBuildStatus({ buildId, progress, status: STATES.ACTIVE });
        if (type === buildTypes.GIT) {
            await _downloadFromGit({ dest, gitRepository });
        }
        else {
            await _downloadFile({ buildId, filePath, src, dest, fileExt, overwrite });
        }
        await _prepareBuild({ buildPath, env, dest, overwrite });
        await _setBuildStatus({ buildId, progress, status: STATES.ACTIVE });
        result = await buildAlgorithmImage({ buildMode, env, docker, algorithmName, imageTag, buildPath, rmi: 'True', baseImage, tmpFolder, packagesRepo, buildId, dependencyInstallCmd });
    }
    catch (e) {
        error = e.message;
        trace = e.stack;
        log.error(e.message, { component }, e);
    }

    const { data, warnings, errors } = _analyzeErrors(result.output, error);
    await _removeFolder({ folder: buildPath });
    const status = errors ? STATES.FAILED : STATES.COMPLETED;
    await _setBuildStatus({ buildId, algorithmName, algorithmImage: result.algorithmImage, buildMode, progress, error, trace, status, endTime: Date.now(), result: { data, warnings, errors } });
    return { buildId, error, status, result: { data, warnings, errors } };
};

module.exports = {
    runBuild,
    runBash,
    buildAlgorithmImage
};

