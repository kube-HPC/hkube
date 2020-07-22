const orderBy = require('lodash.orderby');
const storageManager = require('@hkube/storage-manager');
const validator = require('../validation/api-validator');

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
