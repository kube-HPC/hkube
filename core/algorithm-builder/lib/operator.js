const fse = require('fs-extra');
const storageManager = require('@hkube/storage-manager');
const Logger = require('@hkube/logger');
const builder = require('../lib/builds/builder');
const component = require('../lib/consts/components').OPERATOR;
const etcd = require('./helpers/etcd');

let log;

// TODO: ADD getStream IN S3

class Operator {
    async init(options) {
        log = Logger.GetLogFromContainer();
        try {
            log.debug(`starting build ${options}`, { component });
            const { buildId } = options;
            const build = await etcd.getBuild(buildId);
            const readStream = await storageManager.storage._adapter.getStream({ path: `hkube/${buildId}` });
            const zip = await this._writeStream(readStream, build);
            const { error, result } = await builder.build({ payload: build, file: zip });
            if (result) {
                await etcd.setBuild(buildId, result);
            }
        }
        catch (e) {
            log.error(e.message, { component });
        }
        finally {
            // process.exit(0);
        }
    }

    _writeStream(readStream, build) {
        return new Promise((resolve, reject) => {
            const zip = `${process.cwd()}/uploads/zipped/${build.name}`;
            const writeStream = fse.createWriteStream(zip);
            readStream.pipe(writeStream);
            writeStream.on('close', () => {
                return resolve(zip);
            });
            writeStream.on('error', (err) => {
                return reject(err);
            });
        });
    }
}

module.exports = new Operator();
