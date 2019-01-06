const Zip = require('adm-zip');
const targz = require('targz');
const fse = require('fs-extra');
const { exec } = require('child_process');
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
            const { payload, src } = options;
            const { name, env, version, fileExt } = payload;
            filesToRemove.push(src);

            const envr = `${process.cwd()}/environments/${env}`;
            const dest = `${process.cwd()}/uploads/unzipped/${name}`;
            const buildPath = `${process.cwd()}/builds/${env}/${name}`;
            filesToRemove.push(buildPath);

            await this._extractFile({ src, dest, fileExt, overwrite });

            await fse.ensureDir(buildPath);
            await fse.copy(envr, buildPath);
            await fse.move(dest, `${buildPath}/algorithm`, { overwrite });

            resultData = await this._runBash(`${process.cwd()}/lib/builds/build.sh ${name} ${version} ${buildPath}`);
        }
        catch (e) {
            errorMsg = e;
            log.error(e.message, { component });
        }
        finally {
            this._removeFiles(filesToRemove);
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

    _runBash(command) {
        return new Promise((resolve, reject) => {
            exec(command, (err, stdout, stderr) => {
                if (err) {
                    return reject(stderr);
                }
                return resolve(stdout);
            });
        });
    }

    _removeFiles(files) {
        files.forEach((f) => {
            fse.remove(f).catch((err) => {
                log.error(err);
            });
        });
    }
}

module.exports = new Builder();
