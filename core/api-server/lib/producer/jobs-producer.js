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
        this._producer.on(Events.WAITING, (event) => {
            log.info(`${Events.WAITING} ${event.options.data.jobID}`, { component: components.JOBS_PRODUCER, jobId: event.options.data.jobID, status: States.WAITING });
        }).on(Events.ACTIVE, (event) => {
            log.info(`${Events.ACTIVE} ${event.options.data.jobID}`, { component: components.JOBS_PRODUCER, jobId: event.options.data.jobID, status: States.ACTIVE });
        }).on(Events.COMPLETED, (event) => {
            log.info(`${Events.COMPLETED} ${event.options.data.jobID}`, { component: components.JOBS_PRODUCER, jobId: event.options.data.jobID, status: States.COMPLETED });
        }).on(Events.FAILED, (event) => {
            log.error(`${Events.FAILED} ${event.options.data.jobID}, ${event.error}`, { component: components.JOBS_PRODUCER, jobId: event.options.data.jobID, status: States.FAILED });
        }).on(Events.STALLED, (event) => {
            log.error(`${Events.STALLED} ${event.options.data.jobID}, ${event.error}`, { component: components.JOBS_PRODUCER, jobId: event.options.data.jobID, status: States.STALLED });
        }).on(Events.CRASHED, async (event) => {
            log.error(`${Events.CRASHED} ${event.options.data.jobID}`, { component: components.JOBS_PRODUCER, jobId: event.options.data.jobID, status: States.FAILED });
            const pipeline = await stateManager.getExecution({ jobId: event.options.data.jobID });
            stateManager.setJobStatus({ jobId: event.options.data.jobID, pipeline: pipeline.name, status: States.FAILED, error: event.error, level: levels.error.name });
        });
    }

    async createJob(options) {
        const opt = {
            job: {
                type: JOB_TYPE,
                data: {
                    jobID: options.jobId
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

module.exports = new JobProducer();
