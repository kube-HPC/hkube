const fse = require('fs-extra');
const storageManager = require('@hkube/storage-manager');
const Logger = require('@hkube/logger');
const dockerBuild = require('./builds/docker-builder');
const States = require('../lib/consts/States');
const component = require('../lib/consts/components').OPERATOR;
const etcd = require('./helpers/etcd');

let log;

class Operator {
    async init(options) {
        log = Logger.GetLogFromContainer();
        const { buildId } = options;
        let error;
        let result;
        let image;
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
            const { algorithm } = build;
            await etcd.setBuild(buildId, { ...build, timestamp: new Date(), status: States.ACTIVE });
            const readStream = await storageManager.hkubeBuilds.getStream({ buildId });
            const zipFile = `uploads/zipped/${algorithm.name}`;
            await this._writeStream(readStream, zipFile);
            const response = await dockerBuild({ payload: build, src: zipFile, docker: options.docker });
            error = response.errorMsg;
            result = response.resultData;
            image = response.imageName;
        }
        catch (e) {
            error = e.message;
            log.error(e.message, { component });
        }
        finally {
            const status = error ? States.FAILED : States.COMPLETED;
            log.info(`build ${status} -> ${buildId}. ${error || ''}`, { component });
            await etcd.setBuild(buildId, { ...build, timestamp: new Date(), status, result, error });
            if (status === States.COMPLETED) {
                const { algorithm } = build;
                await etcd._etcd.algorithms.templatesStore.set({ name: algorithm.name, data: { ...algorithm, algorithmImage: image } });
            }
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
