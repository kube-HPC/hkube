const validate = require('djsv');
const { Producer } = require('@hkube/producer-consumer');
const schema = require('../../lib/producer/schema');
const Logger = require('@hkube/logger');
const log = Logger.GetLogFromContainer();
const components = require('../../common/consts/componentNames');
const { tracer } = require('@hkube/metrics');

class JobProducer {
    init(options) {
        const setting = Object.assign({}, { redis: options.redis });
        const res = validate(schema.properties.setting, setting);
        if (!res.valid) {
            throw new Error(res.error);
        }
        setting.tracer = tracer;
        this._producer = new Producer({ setting });
        this._producer.on('job-waiting', (data) => {
            log.info(`job waiting ${data.jobID}`, { component: components.JOBS_PRODUCER });
        }).on('job-active', (data) => {
            log.info(`job active ${data.jobID}`, { component: components.JOBS_PRODUCER });
        }).on('job-completed', (data) => {
            log.info(`job completed ${data.jobID}`, { component: components.JOBS_PRODUCER });
        }).on('job-failed', (data) => {
            log.error(`job failed ${data.jobID}, error: ${data.error}`, { component: components.JOBS_PRODUCER });
        });
    }

    async createJob(options) {
        const opt = {
            job: {
                id: options.jobId,
                type: 'pipeline-driver-job'
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

    async stopJob(options) {
        return this._producer.stopJob({ type: 'pipeline-driver-job', jobID: options.jobId });
    }
}

module.exports = new JobProducer();
