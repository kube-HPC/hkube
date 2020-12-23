const { Readable } = require('stream');
const archiver = require('archiver');
const orderBy = require('lodash.orderby');
const { uid } = require('@hkube/uid');
const storageManager = require('@hkube/storage-manager');
const validator = require('../validation/api-validator');
const executions = require('./execution');
const stateManager = require('../state/state-manager');
const { ResourceNotFoundError } = require('../errors');

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
            const names = result.data.map(d => d.algorithmName);
            algorithmsMap = await stateManager.getAlgorithmsMapByNames({ names });
        }
        const archive = archiver('zip', { zlib: { level: 9 } });
        const archiveData = await Promise.all(result.data.map(d => this._createArchive(d, algorithmsMap, archive)));
        this._archiveMetadata(archive, archiveData);
        archive.finalize();
        return archive;
    }

    async _createArchive(data, algorithmsMap, archive) {
        let info;
        if (data.info) {
            const algorithm = algorithmsMap.get(data.algorithmName);
            const ext = algorithm?.downloadFileExt || 'hkube';
            const fileName = `${uid()}.${ext}`;
            const stream = await storageManager.getCustomStream({ path: data.info.path });
            archive.append(stream, { name: fileName });
            info = { size: data.info.size, fileName };
        }
        return { ...data, info };
    }

    _archiveMetadata(archive, data) {
        const stream = new Readable();
        stream.push(JSON.stringify(data));
        stream.push(null);
        archive.append(stream, { name: 'metadata.json' });
    }

    _formatResponse({ path, keys, sort, order, from, to }) {
        const orderKeys = orderBy(keys, sort, order);
        const sliceKeys = orderKeys.slice(from, to);
        return { path, total: keys.length, keys: sliceKeys };
    }

    async getByPath({ path }) {
        const { payload } = await storageManager.getCustomData({ path });
        return payload;
    }
}

module.exports = new StorageService();
