const fse = require('fs-extra');
const storageManager = require('@hkube/storage-manager');
const Logger = require('@hkube/logger');
const builder = require('../lib/builds/builder');
const component = require('../lib/consts/components').OPERATOR;
const etcd = require('./helpers/etcd');

let log;

class Operator {
    async init(options) {
        log = Logger.GetLogFromContainer();
        const { buildId } = options;
        let error;
        let result;
        let build;
        try {
            if (!buildId) {
                throw new Error('build id is required');
            }
            log.info(`build started -> ${buildId}`, { component });
            build = await etcd.getBuild({ buildId });
            if (!build) {
                throw new Error(`unable to find build -> ${buildId}`);
            }
            await etcd.setBuild(buildId, { ...build, timestamp: new Date(), status: 'active' });
            const readStream = await storageManager.storage._adapter.getStream({ path: `hkube/builds/${buildId}` });
            const zipFile = `${process.cwd()}/uploads/zipped/${build.name}`;
            await this._writeStream(readStream, zipFile);
            const response = await builder.build({ payload: build, src: zipFile, docker: options.docker });
            error = response.errorMsg;
            result = response.resultData;
        }
        catch (e) {
            error = e.message;
            log.error(e.message, { component });
        }
        finally {
            const status = error ? 'failed' : 'completed';
            log.info(`build ${status} -> ${buildId}. ${error}`, { component });
            await etcd.setBuild(buildId, { ...build, timestamp: new Date(), status, result, error });
            process.exit(0);
        }
    }

    _writeStream(readStream, zip) {
        return new Promise((resolve, reject) => {
            const writeStream = fse.createWriteStream(zip);
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
    }
}

module.exports = new Operator();
