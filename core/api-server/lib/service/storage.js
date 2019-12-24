
const pathLib = require('path');
const storageManager = require('@hkube/storage-manager');

class StorageService {
    init(config) {
        this.config = config;
    }

    getInfo() {
        return {
            storage: this.config.defaultStorage,
        };
    }

    get prefixesTypes() {
        return storageManager.prefixesTypes;
    }

    async getPrefixesByPath({ path }) {
        const result = await storageManager.storage.listPrefixes({ path });
        return result.map(p => pathLib.join(path, p));
    }

    async allPrefixes() {
        return Promise.all(this.prefixesTypes.map(k => this._prefixes(k)));
    }

    async getKeysByPath({ path }) {
        return storageManager.storage.listWithStats({ path });
    }

    async getAllKeys() {
        return Promise.all(this.prefixesTypes.map(k => this._keys(k)));
    }

    async getStream({ path }) {
        return storageManager.getStream({ path });
    }

    async _prefixes(path) {
        const keys = await this.getPrefixesByPath({ path });
        return this._formatKeys(path, keys);
    }

    async _keys(path) {
        const keys = await this.getKeysByPath({ path });
        return this._formatKeys(path, keys);
    }

    async _formatKeys(path, keys) {
        return { prefix: path, total: keys.length, keys };
    }

    getByPath({ path }) {
        return storageManager.storage.get({ path });
    }
}

module.exports = new StorageService();
