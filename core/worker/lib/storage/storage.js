const isEqual = require('lodash.isequal');
const Logger = require('@hkube/logger');
const { dataAdapter } = require('@hkube/worker-data-adapter');
const { tracer } = require('@hkube/metrics');
const tracing = require('../tracing/tracing.js');
const stateManager = require('../states/stateManager');
const { Components } = require('../consts');
const component = Components.STORAGE;
let log;

class Storage {
    constructor() {
        this.oldStorage = null;
        this._storageProtocols = {
            byRaw: this._tryExtractDataFromStorage.bind(this),
            byRef: (data) => ({ data })
        };
    }

    async init(options) {
        log = Logger.GetLogFromContainer();
        await dataAdapter.init(options);
    }

    setStorage(type) {
        this._getStorage = this._storageProtocols[type];
    }

    async extractData(options) {
        const { input, storage } = options;
        const flatInput = dataAdapter.flatInput({ input, storage });

        let useCache = true;
        if (!this._isStorageEqual(storage, this.oldStorage)) {
            useCache = false;
        }
        this.oldStorage = storage;

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

    async _tryExtractDataFromStorage(options) {
        const partial = (func, argsBound) => (args) => {
            return func.call(tracer, { ...argsBound, tags: { ...argsBound.tags, ...args } });
        };
        try {
            const { jobId, taskId, input, flatInput, useCache, storage } = options;
            const tracerStart = partial(tracer.startSpan, tracing.getTracer({ name: 'storage-get', jobId, taskId }));
            const newInput = await dataAdapter.getData({ input, flatInput, useCache, storage, tracerStart: null });
            return { data: { ...options, input: newInput, flatInput: null } };
        }
        catch (error) {
            return { error };
        }
    }

    createStorageInfo(options) {
        return dataAdapter.createStorageInfo(options);
    }

    setData(options) {
        const { jobId, taskId } = options;
        return dataAdapter.setData(options, tracer.startSpan.bind(tracer, tracing.getTracer({ name: 'storage-put', jobId, taskId })));
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
                paths.push(...v.map(p => p.storageInfo.path));
            }
        });
        return paths.sort();
    }
}

module.exports = new Storage();
