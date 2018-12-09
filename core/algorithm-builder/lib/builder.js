const Zip = require('adm-zip');
const fse = require('fs-extra');
const uuid = require('uuid/v4');
const exec = require('child_process').exec;

class Builder {

    async build(options) {
        let buildPath;
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

            const result = await this._runBash(`${buildPath}/builder/build.sh ${alg} ${buildPath}`);
            return result;
        }
        catch (e) {
            console.error(e)
        }
        finally {
            this._removeFile(buildPath);
        }
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
        fse.remove(file).then(() => {
            console.log('success!')
        }).catch(err => {
            console.error(err)
        })
    }
}

module.exports = new Builder();

