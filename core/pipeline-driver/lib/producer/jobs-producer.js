const EventEmitter = require('events');
const Validator = require('ajv');
const { Producer, Events } = require('@hkube/producer-consumer');
const { tracer } = require('@hkube/metrics');
const schema = require('./schema');
const { TASKS } = require('../consts/Events');
const validator = new Validator({ useDefaults: true, coerceTypes: true });

class JobProducer extends EventEmitter {
    constructor() {
        super();
        this._producer = null;
    }

    async init(option) {
        const options = option || {};
        const setting = Object.assign({}, { redis: options.redis });
        const valid = validator.validate(schema.properties.setting, setting);
        if (!valid) {
            const error = validator.errorsText(validator.errors);
            throw new Error(error);
        }
        setting.tracer = tracer;
        this._producer = new Producer({ setting });
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
