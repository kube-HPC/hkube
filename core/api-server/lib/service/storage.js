const { Readable } = require('stream');
const fs = require('fs-extra');
const archiver = require('archiver');
const orderBy = require('lodash.orderby');
const { uuid, uid } = require('@hkube/uid');
const storageManager = require('@hkube/storage-manager');
const validator = require('../validation/api-validator');
const executions = require('./execution');
const stateManager = require('../state/state-manager');
const { ResourceNotFoundError, InvalidDataError, } = require('../errors');

class StorageService {
    init(config) {
        this.config = config;
        this.maxStorageFetchKeys = config.maxStorageFetchKeys;
    }

    getInfo() {
        return storageManager.getInfo();
    }

    get prefixesTypes() {
        return storageManager.prefixesTypes;
    }

    async getPrefixesByPath({ path, ...options }) {
        validator.lists.validateListRange(options);
        return this._getPrefixesByPath({ path, ...options });
    }

    async _getPrefixesByPath({ path, sort, order, from, to }) {
        const keys = await storageManager.storage.listPrefixes({ path });
        const result = this._formatResponse({ path, keys, sort, order, from, to });
        return result;
    }

    async getAllPrefixes(options) {
        validator.lists.validateListRange(options);
        return Promise.all(this.prefixesTypes.map(path => this._getPrefixesByPath({ path, ...options })));
    }

    async getKeysByPath({ path, ...options }) {
        validator.lists.validateListRange(options);
        return this._getKeysByPath({ path, ...options });
    }

    async _getKeysByPath({ path, sort, order, from, to }) {
        const keys = await storageManager.storage.listWithStats({ path, maxKeys: this.maxStorageFetchKeys });
        return this._formatResponse({ path, keys, sort, order, from, to });
    }

    async getAllKeys(options) {
        validator.lists.validateListRange(options);
        return Promise.all(this.prefixesTypes.map(path => this._getKeysByPath({ path, ...options })));
    }

    async getStream(options) {
        return storageManager.getStream(options);
    }

    async getMetadata({ path }) {
        return storageManager.getMetadata({ path });
    }

    checkDataSize(size) {
        return storageManager.checkDataSize(size);
    }

    async getCustomStream(options) {
        return storageManager.getCustomStream(options);
    }

    async getPipelineResult(options) {
        const result = await executions.getJobResult(options);
        if (!result.data) {
            throw new ResourceNotFoundError('results', options.jobId);
        }
        const hasLargeResults = result.data.some(d => d.info);
        let algorithmsMap;
        if (hasLargeResults) {
            const algorithmList = await stateManager.algorithms.store.list({ limit: 1000 });
            algorithmsMap = new Map(algorithmList.map((a) => [a.name, a]));
        }

        const source = `uploads/tmp/${uuid()}`;
        const zipName = `${source}/result.zip`;
        await fs.ensureDir(source);
        const archive = archiver('zip', { zlib: { level: 9 } });

        result.data = await Promise.all(result.data.map(async d => {
            let info;
            if (d.info) {
                const algorithms = algorithmsMap.get(d.algorithmName);
                const ext = algorithms.downloadFileExt || 'hkube';
                const fileName = `${uid()}.${ext}`;
                const stream = await storageManager.getCustomStream({ path: d.info.path });
                archive.append(stream, { name: fileName });
                info = { size: d.info.size, fileName };
            }
            return { ...d, info };
        }));
        this._archiveMetadata(archive, result.data);
        const path = await this._createZip(archive, zipName);
        const stream = fs.createReadStream(path);
        return { stream, path: source };
    }

    cleanPipelineResult(path) {
        fs.remove(path);
    }

    _archiveMetadata(archive, data) {
        const stream = new Readable();
        stream.push(JSON.stringify(data));
        stream.push(null);
        archive.append(stream, { name: 'metadata.json' });
    }

    _createZip(archive, zipName) {
        const stream = fs.createWriteStream(zipName);

        return new Promise((resolve, reject) => {
            archive.on('error', err => reject(err))
                .pipe(stream);

            stream.on('close', () => resolve(zipName));
            archive.finalize();
        });
    }

    _formatResponse({ path, keys, sort, order, from, to }) {
        const orderKeys = orderBy(keys, sort, order);
        const sliceKeys = orderKeys.slice(from, to);
        return { path, total: keys.length, keys: sliceKeys };
    }

    getByPath({ path }) {
        return storageManager.storage.get({ path, encodeOptions: { customEncode: true } });
    }
}

module.exports = new StorageService();
