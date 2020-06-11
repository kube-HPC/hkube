const { tracer } = require('@hkube/metrics');
const Logger = require('@hkube/logger');
let log;

class Tracing {
    constructor() {
        this._algTracer = null;
    }

    async init(options) {
        log = Logger.GetLogFromContainer();
        const algorithmName = options.jobConsumer.job.type;
        this._algTracer = await tracer.createTracer(algorithmName, options.tracer);
    }

    getTopSpan(taskId) {
        let parent = null;
        const topWorkerSpan = tracer.topSpan(taskId);
        if (topWorkerSpan) {
            parent = topWorkerSpan.context();
        }
        return parent;
    }

    getTracer({ name, jobId, taskId }) {
        let parent = null;
        const topWorkerSpan = tracer.topSpan(taskId);
        if (topWorkerSpan) {
            parent = topWorkerSpan.context();
        }
        return {
            name,
            id: taskId,
            parent,
            tags: {
                jobId,
                taskId
            }
        };
    }

    get algTracer() {
        return this._algTracer;
    }

    startAlgorithmSpan({ data, jobId, taskId, spanId }) {
        if (!data || !data.name) {
            log.warning('invalid startSpan message');
            return;
        }
        const spanOptions = {
            name: data.name,
            id: taskId,
            tags: {
                ...data.tags,
                jobId,
                taskId,
            }
        };
        // set parent span
        if (!this.algTracer.topSpan(taskId)) {
            const topWorkerSpan = tracer.topSpan(taskId);
            if (topWorkerSpan) {
                spanOptions.parent = topWorkerSpan.context();
            }
            else {
                //         log.warning('temp log message: no top span in start alg span');
                spanOptions.parent = spanId;
            }
        }
        // start span
        this.algTracer.startSpan(spanOptions);
    }

    finishAlgorithmSpan({ data, taskId }) {
        if (!data) {
            log.warning('invalid finishSpan message');
            return;
        }
        const topSpan = this.algTracer.topSpan(taskId);
        if (topSpan) {
            if (data.tags) {
                topSpan.addTag(data.tags);
            }
            topSpan.finish(data.error);
        }
        else {
            log.warning('got finishSpan request but algorithm span stack is empty!');
        }
    }
}

module.exports = new Tracing();
