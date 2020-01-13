const EventEmitter = require('events');
const { Producer } = require('@hkube/producer-consumer');
const { tracer } = require('@hkube/metrics');

class JobProducer extends EventEmitter {
    constructor() {
        super();
        this._producer = null;
    }

    async init(option) {
        const options = option || {};
        this._producer = new Producer({
            setting: {
                tracer,
                redis: options.redis,
                ...options.jobs.producer
            }
        });
    }

    async createJob(options) {
        const opt = {
            job: {
                type: options.type,
                data: options.data
            }
        };
        if (options.data && options.data.jobId) {
            const topSpan = tracer.topSpan(options.data.jobId);
            if (topSpan) {
                opt.tracing = {
                    parent: topSpan.context(),
                    tags: {
                        jobId: options.data.jobId
                    }
                };
            }
        }
        return this._producer.createJob(opt);
    }
}

module.exports = new JobProducer();
