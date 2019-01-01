const Zip = require('adm-zip');
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
            const { payload, file } = options;
            filesToRemove.push(file);
            const zip = new Zip(file);
            const alg = payload.name;
            const env = `${process.cwd()}/environments/${payload.env}`;
            const code = `${process.cwd()}/uploads/unzipped/${alg}`;
            const buildPath = `${process.cwd()}/builds/${payload.env}/${alg}`;
            filesToRemove.push(buildPath);
            zip.extractAllTo(code, overwrite);

            await fse.ensureDir(buildPath);
            await fse.copy(env, buildPath);
            await fse.move(code, `${buildPath}/algorithm`, { overwrite });

            resultData = await this._runBash(`${process.cwd()}/lib/builds/build.sh ${alg} ${payload.version} ${buildPath}`);
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
