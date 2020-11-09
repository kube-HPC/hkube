const isEqual = require('lodash.isequal');
const Logger = require('@hkube/logger');
const { dataAdapter } = require('@hkube/worker-data-adapter');
const stateManager = require('../states/stateManager');
const { Components, jobStatus } = require('../consts');
const component = Components.STORAGE;
let log;

class Storage {
    constructor() {
        this._oldStorage = null;
    }

    async init(options) {
        log = Logger.GetLogFromContainer();
        await dataAdapter.init(options);
    }

    async start(options) {
        let error;
        try {
            await this._start(options);
        }
        catch (e) {
            error = e;
        }
        return { error };
    }

    async finish(options) {
        return this._finish(options);
    }

    setStorageType(type) {
        const storage = require(`./storage-${type}`); // eslint-disable-line
        this._start = (...args) => storage.start(...args);
        this._finish = (...args) => storage.finish(...args);
        this._getStorage = (...args) => storage.getResultFromStorage(...args);
        this._setStorage = (...args) => storage.setResultToStorage(...args);
    }

    async extractData(options) {
        const { input, storage } = options;
        const flatInput = dataAdapter.flatInput({ input, storage });
        const useCache = this._isStorageEqual(storage, this._oldStorage);
        this._oldStorage = storage;

        const newOptions = {
            useCache,
            flatInput,
            ...options,
        };
        const { error, data } = await this._getStorage(newOptions);
        if (error) {
            log.error(`failed to extract data input: ${error.message}`, { component }, error);
            stateManager.done({ error });
        }
        return { error, data };
    }

    async setStorage(options) {
        let error;
        let status = jobStatus.SUCCEED;
        try {
            await this._setStorage(options);
        }
        catch (err) {
            log.error(`failed to store data ${err}`, { component }, err);
            error = err.message;
            status = jobStatus.FAILED;
        }
        return {
            status,
            error
        };
    }

    _isStorageEqual(storage1, storage2) {
        if (storage1 && storage2) {
            const links1 = this._extractPaths(storage1);
            const links2 = this._extractPaths(storage2);
            return isEqual(links1, links2);
        }
        return storage1 === storage2;
    }

    _extractPaths(storage) {
        const paths = [];
        Object.values(storage).forEach((v) => {
            if (v.storageInfo) {
                paths.push(v.storageInfo.path);
            }
            else if (Array.isArray(v)) {
                paths.push(...v.filter(p => p.storageInfo).map(p => p.storageInfo.path));
            }
        });
        return paths.sort();
    }
}

module.exports = new Storage();
