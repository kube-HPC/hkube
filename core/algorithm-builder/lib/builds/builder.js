const Zip = require('adm-zip');
const targz = require('targz');
const fse = require('fs-extra');
const { spawn, exec } = require('child_process');
const Logger = require('@hkube/logger');
const component = require('../consts/components').OPERATOR;

let log;

class Builder {
    async init() {
        log = Logger.GetLogFromContainer();
    }

    async build(options) {
        let errorMsg;
        let resultData;
        const filesToRemove = [];
        try {
            const overwrite = true;
            const { payload, src, docker, deleteSrc } = options;
            const { buildId, name, env, version, fileExt } = payload;

            if (deleteSrc) {
                filesToRemove.push(src);
            }

            const envr = `${process.cwd()}/environments/${env}`;
            const dest = `${process.cwd()}/uploads/unzipped/${name}`;
            const buildPath = `${process.cwd()}/builds/${env}/${name}`;
            filesToRemove.push(buildPath);

            await this._extractFile({ src, dest, fileExt, overwrite });

            await fse.ensureDir(buildPath);
            await fse.copy(envr, buildPath);
            await fse.move(dest, `${buildPath}/algorithm`, { overwrite });

            const dockerArgs = [docker.registry, docker.namespace, docker.user, docker.pass];
            const args = [buildId, name, env, version, ...dockerArgs, buildPath];
            // resultData = await this._runBash(`${process.cwd()}/lib/builds/build.sh ${args.join(' ')}`);
            resultData = await this._runBashSpawn(`${process.cwd()}/lib/builds/build.sh`, args);
        }
        catch (e) {
            errorMsg = e;
            log.error(e.message, { component });
        }
        finally {
            await this._removeFiles(filesToRemove);
        }
        return { errorMsg, resultData };
    }

    async _extractFile({ src, dest, fileExt, overwrite }) {
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

    _runBashExec(command) {
        return new Promise((resolve, reject) => {
            exec(command, (err, stdout, stderr) => {
                if (err) {
                    return reject({ error: stderr });
                }
                return resolve({ result: stdout });
            });
        });
    }

    _runBashSpawn(command, args) {
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

    async _removeFiles(files) {
        await Promise.all(files.map((f) => fse.remove(f)));
    }
}

module.exports = new Builder();
