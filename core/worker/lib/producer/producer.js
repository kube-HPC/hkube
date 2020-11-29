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
            tracer
        };
        const valid = this._schema(setting);
        if (!valid) {
            throw new Error(validator.errorsText(this._schema.errors));
        }
        this._producer = new Producer({ setting });
    }

    createJob({ jobData, tracing }) {
        const job = this._createJobData(jobData);
        return this._producer.createJob({ job, tracing });
    }

    _createJobData(options) {
        const jobOptions = {
            type: options.algorithmName,
            data: {
                jobId: options.jobId,
                tasks: options.tasks,
                nodeName: options.nodeName,
                algorithmName: options.algorithmName,
                parentNodeName: options.parentNodeName,
                pipelineName: options.pipelineName,
                priority: options.priority,
                metrics: options.metrics,
                ttl: options.ttl,
                retry: options.retry,
                stateType: options.stateType,
                kind: options.kind,
                parents: options.parents,
                childs: options.childs,
                info: options.info,
                isScaled: options.isScaled,
                parsedFlow: options.parsedFlow,
                defaultFlow: options.defaultFlow,
            }
        };
        return jobOptions;
    }

    createTaskID() {
        return uid({ length: 8 });
    }
}

module.exports = new Producers();
