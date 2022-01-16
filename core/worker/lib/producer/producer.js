const Validator = require('ajv');
const { tracer } = require('@hkube/metrics');
const { uid } = require('@hkube/uid');
const { Producer } = require('@hkube/producer-consumer');
const { schema } = require('./schema');
const validator = new Validator({ useDefaults: true, coerceTypes: false });

class Producers {
    init(options) {
        this._schema = validator.compile(schema);
        const setting = {
            redis: options.redis,
            tracer,
            enableCheckStalledJobs: false
        };
        const valid = this._schema(setting);
        if (!valid) {
            throw new Error(validator.errorsText(this._schema.errors));
        }
        this._producer = new Producer({ setting });
    }

    createJob({ id, jobId, algorithmName, tracing }) {
        const job = this._createJobData({ id, jobId, algorithmName });
        return this._producer.createJob({ job, tracing });
    }

    _createJobData({ id, jobId, algorithmName }) {
        const jobOptions = {
            type: algorithmName,
            data: {
                id,
                jobId

            }
        };
        return jobOptions;
    }

    createTaskID() {
        return uid({ length: 8 });
    }
}

module.exports = new Producers();
