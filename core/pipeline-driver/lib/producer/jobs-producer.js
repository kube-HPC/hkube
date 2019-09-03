const EventEmitter = require('events');
const { Producer, Events } = require('@hkube/producer-consumer');
const { tracer } = require('@hkube/metrics');
const { TASKS } = require('../consts/Events');

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
        this._producer.on(Events.WAITING, (data) => {
            this.emit(TASKS.WAITING, data.jobId);
        }).on(Events.COMPLETED, (data) => {
            this.emit(TASKS.SUCCEED, data.jobId);
        }).on(Events.ACTIVE, (data) => {
            this.emit(TASKS.ACTIVE, data.jobId);
        }).on(Events.STALLED, (data) => {
            this.emit(TASKS.STALLED, data.jobId);
        }).on(Events.CRASHED, (data) => {
            this.emit(TASKS.CRASHED, { taskId: data.jobId, error: data.error });
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
