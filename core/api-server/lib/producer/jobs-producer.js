const validate = require('djsv');
const { Producer, Events } = require('@hkube/producer-consumer');
const schema = require('../../lib/producer/schema');
const stateManager = require('../state/state-manager');
const Logger = require('@hkube/logger');
const log = Logger.GetLogFromContainer();
const components = require('../../common/consts/componentNames');
const { tracer } = require('@hkube/metrics');
const States = require('../state/States');
const levels = require('../progress/progressLevels');
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
        this._producer.on(Events.WAITING, (data) => {
            log.info(`${Events.WAITING} ${data.jobID}`, { component: components.JOBS_PRODUCER, jobId: data.jobID, status: States.WAITING });
        }).on(Events.ACTIVE, (data) => {
            log.info(`${Events.ACTIVE} ${data.jobID}`, { component: components.JOBS_PRODUCER, jobId: data.jobID, status: States.ACTIVE });
        }).on(Events.COMPLETED, (data) => {
            log.info(`${Events.COMPLETED} ${data.jobID}`, { component: components.JOBS_PRODUCER, jobId: data.jobID, status: States.COMPLETED });
        }).on(Events.FAILED, (data) => {
            log.error(`${Events.FAILED} ${data.jobID}, ${data.error}`, { component: components.JOBS_PRODUCER, jobId: data.jobID, status: States.FAILED });
        }).on(Events.STALLED, (data) => {
            log.error(`${Events.STALLED} ${data.jobID}, ${data.error}`, { component: components.JOBS_PRODUCER, jobId: data.jobID, status: States.STALLED });
        }).on(Events.CRASHED, async (data) => {
            log.error(`${Events.CRASHED} ${data.jobID}`, { component: components.JOBS_PRODUCER, jobId: data.jobID, status: States.FAILED });
            const pipeline = await stateManager.getExecution({ jobId: data.jobID });
            stateManager.setJobStatus({ jobId: data.jobID, pipeline: pipeline.name, status: States.FAILED, error: data.error, level: levels.error.name });
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
