const { dataAdapter } = require('@hkube/worker-data-adapter');
const { tracer } = require('@hkube/metrics');
const { pipelineKind } = require('@hkube/consts');
const jobConsumer = require('../consumer/JobConsumer');
const tracing = require('../tracing/tracing.js');

class Storage {
    _startSpanBound(func, argsBound) {
        return (args) => {
            return func.call(tracer, { ...argsBound, tags: { ...argsBound.tags, ...args } });
        };
    }

    async start(options) {
        const { kind } = options;
        if (kind === pipelineKind.Stream) {
            throw new Error(`${kind} is not supported in this algorithm`);
        }
    }

    async finish() {
        return null;
    }

    async getResultFromStorage(options) {
        try {
            const { jobId, taskId, input, flatInput, useCache, storage, startSpan } = options;
            const tracerStart = startSpan || this._startSpanBound(tracer.startSpan, tracing.getTracer({ name: 'storage-get', jobId, taskId }));
            const newInput = await dataAdapter.getData({ input, flatInput, useCache, storage, tracerStart });
            return { data: { ...options, input: newInput, flatInput: null } };
        }
        catch (error) {
            return { error };
        }
    }

    async setResultToStorage(options) {
        const { jobData, data } = options;
        const { jobId, taskId, nodeName, info } = jobData;
        const startSpan = tracer.startSpan.bind(tracer, tracing.getTracer({ name: 'storage-put', jobId, taskId }));
        const encodedData = dataAdapter.encode(data, { customEncode: true });
        const storageInfo = dataAdapter.createStorageInfo({ jobId, taskId, nodeName, data, encodedData, savePaths: info.savePaths });
        await dataAdapter.setData({ jobId, taskId, data: encodedData }, startSpan);
        await jobConsumer.setStoringStatus(storageInfo);
        return storageInfo;
    }
}

module.exports = new Storage();
