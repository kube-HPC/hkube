
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
        const { error, data } = await this._getStorage(options);
        if (error) {
            log.error(`failed to extract data input: ${error.message}`, { component }, error);
            stateManager.done({ error });
        }
        return { error, data };
    }

    async _tryExtractDataFromStorage(options) {
        function partial(func, argsBound) {
            return (args) => {
                return func.call(tracer, { ...argsBound, tags: { ...argsBound.tags, ...args } });
            };
        }
        try {
            const { jobId, taskId } = options;
            const input = await dataAdapter.getData(options.input, options.storage, partial(tracer.startSpan, tracing.getTracer({ name: 'storage-get', jobId, taskId })));
            return { data: { ...options, input } };
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
}

module.exports = new Storage();
