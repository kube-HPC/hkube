const { tracer } = require('@hkube/metrics');
const { Producer } = require('@hkube/producer-consumer');

class PreferenceProducer {
    init(options) {
        const { jobType, ...producer } = options.jobs.producer;
        this._jobType = jobType;
        this._producer = new Producer({
            setting: {
                tracer,
                redis: options.redis,
                ...producer
            }
        });
    }

    async createJob(options) {
        const opt = {
            job: {
                type: 'preference-update',
                data: {
                    jobId: options.jobId
                }
            }
        };
        if (options.parentSpan) {
            opt.tracing = {
                parent: options.parentSpan,
                parentRelationship: tracer.parentRelationships.follows
            };
        }
        return this._producer.createJob(opt);
    }
}

module.exports = new PreferenceProducer();
