const { dataAdapter } = require('@hkube/worker-data-adapter');
const { tracer } = require('@hkube/metrics');
const jobConsumer = require('../consumer/JobConsumer');
const tracing = require('../tracing/tracing.js');
const { Components, jobStatus } = require('../consts');
const component = Components.STORAGE;
let log;

class Storage {
    _startSpanBound(func, argsBound) {
        return (args) => {
            return func.call(tracer, { ...argsBound, tags: { ...argsBound.tags, ...args } });
        };
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
        let error;
        let status = jobStatus.SUCCEED;
        const { jobData, data, lastStorageInfo, lastStatus } = options;
        const { jobId, taskId, nodeName, info } = jobData;

        let storageInfo = lastStorageInfo;
        try {
            if (lastStatus !== jobStatus.STORING) {
                const startSpan = tracer.startSpan.bind(tracer, tracing.getTracer({ name: 'storage-put', jobId, taskId }));
                const encodedData = dataAdapter.encode(data);

                storageInfo = dataAdapter.createStorageInfo({ jobId, taskId, nodeName, data, encodedData, savePaths: info.savePaths });
                await dataAdapter.setData({ jobId, taskId, data }, startSpan);
                await jobConsumer.setStoringStatus(storageInfo);
            }
        }
        catch (err) {
            log.error(`failed to store data job:${jobId} task:${taskId}, ${err}`, { component }, err);
            error = err.message;
            status = jobStatus.FAILED;
        }
        finally {
            // eslint-disable-next-line no-unsafe-finally
            return {
                status,
                error,
                storageInfo
            };
        }
    }
}

module.exports = new Storage();
