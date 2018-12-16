const Zip = require('adm-zip');
const fse = require('fs-extra');
const uuid = require('uuid/v4');
const { exec } = require('child_process');
const log = require('@hkube/logger').GetLogFromContainer();

class Builder {
    async build(options) {
        let buildPath;
        let error;
        let result;
        try {
            const payload = JSON.parse(options.payload);
            const zip = new Zip(options.file);
            const alg = payload.name;
            const env = `${process.cwd()}/environments/${payload.env}`;
            const code = `${process.cwd()}/uploads/unzipped/${alg}`;
            buildPath = `${process.cwd()}/builds/${payload.env}/${alg}-${uuid()}`;
            zip.extractAllTo(code, true);

            await fse.ensureDir(buildPath);
            await fse.copy(env, buildPath);
            await fse.move(code, `${buildPath}/algorithm`);

            result = await this._runBash(`${process.cwd()}/lib/build.sh ${alg} ${buildPath}`);
        }
        catch (e) {
            log.error(e);
            error = e;
        }
        finally {
            this._removeFile(buildPath);
        }
        return { error, result };
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

    _removeFile(file) {
        fse.remove(file).catch((err) => {
            log.error(err);
        });
    }
}

module.exports = new Builder();
