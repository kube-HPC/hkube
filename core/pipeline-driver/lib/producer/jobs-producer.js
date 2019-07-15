const EventEmitter = require('events');
const Validator = require('ajv');
const { Producer } = require('@hkube/producer-consumer');
const { tracer } = require('@hkube/metrics');
const schema = require('./schema');
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
