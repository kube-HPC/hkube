const validate = require('djsv');
const { Producer } = require('@hkube/producer-consumer');
const schema = require('../../lib/producer/schema');
const Logger = require('@hkube/logger');
const log = Logger.GetLogFromContainer();
const components = require('../../common/consts/componentNames');
const { tracer } = require('@hkube/metrics');
const States = require('../state/States');
const JOB_TYPE = 'pipeline-driver-job';

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
            log.info(`job waiting ${data.jobID}`, { component: components.JOBS_PRODUCER, jobId: data.jobID, status: States.WAITING });
        }).on('job-active', (data) => {
            log.info(`job active ${data.jobID}`, { component: components.JOBS_PRODUCER, jobId: data.jobID, status: States.ACTIVE });
        }).on('job-completed', (data) => {
            log.info(`job completed ${data.jobID}`, { component: components.JOBS_PRODUCER, jobId: data.jobID, status: States.COMPLETED });
        }).on('job-failed', (data) => {
            log.error(`job failed ${data.jobID}, error: ${data.error}`, { component: components.JOBS_PRODUCER, jobId: data.jobID, status: States.FAILED });
        }).on('job-stalled', (data) => {
            log.error(`job stalled ${data.jobID}, error: ${data.error}`, { component: components.JOBS_PRODUCER, jobId: data.jobID, status: States.STALLED });
        });
    }

    async createJob(options) {
        const opt = {
            job: {
                id: options.jobId,
                type: JOB_TYPE
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

module.exports = new JobProducer();
