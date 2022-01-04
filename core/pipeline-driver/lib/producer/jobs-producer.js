const EventEmitter = require('events');
const { Producer, Events } = require('@hkube/producer-consumer');
const { tracer } = require('@hkube/metrics');
const Logger = require('@hkube/logger');
const component = require('../consts/componentNames').JOBS_PRODUCER;
let log;

class JobProducer extends EventEmitter {
    constructor() {
        super();
        this._producer = null;
    }

    async init(option) {
        log = Logger.GetLogFromContainer();
        const options = option || {};
        this._producer = new Producer({
            setting: {
                tracer,
                redis: options.redis,
                ...options.jobs.producer
            }
        });
        this._producer.on(Events.WAITING, (data) => {
            const jobId = data?.options?.data?.jobId;
            const tasks = data?.options?.data?.tasks || [];
            const taskIds = tasks.map(t => t.taskId).join(',');
            log.info(`${Events.WAITING} ${jobId} ${taskIds}`, { component, jobId, status: Events.WAITING });
        });
        this._producer.on(Events.ACTIVE, async (data) => {
            const jobId = data?.options?.data?.jobId;
            const tasks = data?.options?.data?.tasks || [];
            const taskIds = tasks.map(t => t.taskId).join(',');
            log.info(`${Events.ACTIVE} ${jobId} ${taskIds}`, { component, jobId, status: Events.ACTIVE });
        });
        this._producer.on(Events.COMPLETED, (data) => {
            const jobId = data?.options?.data?.jobId;
            const tasks = data?.options?.data?.tasks || [];
            const taskIds = tasks.map(t => t.taskId).join(',');
            log.info(`${Events.COMPLETED} ${jobId} ${taskIds}`, { component, jobId, status: Events.COMPLETED });
        });
        this._producer.on(Events.FAILED, (data) => {
            const jobId = data?.options?.data?.jobId;
            const tasks = data?.options?.data?.tasks || [];
            const taskIds = tasks.map(t => t.taskId).join(',');
            log.info(`${Events.FAILED} ${jobId} ${taskIds} error: ${data?.error}`, { component, jobId, status: Events.FAILED });
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
