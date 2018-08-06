const Validator = require('ajv');
const validator = new Validator({ useDefaults: true, coerceTypes: true });
const { Producer, Events } = require('@hkube/producer-consumer');
const schema = require('../../lib/producer/schema');
const stateManager = require('../state/state-manager');
const Logger = require('@hkube/logger');
const log = Logger.GetLogFromContainer();
const components = require('../../common/consts/componentNames');
const { tracer } = require('@hkube/metrics');
const States = require('../state/States');
const levels = require('../progress/progressLevels');
const JOB_TYPE = 'pipeline-job';

class JobProducer {
    init(options) {
        const setting = Object.assign({}, { redis: options.redis });
        const valid = validator.validate(schema.properties.setting, setting);
        if (!valid) {
            const error = validator.errorsText(validator.errors);
            throw new Error(error);
        }
        setting.tracer = tracer;
        this._producer = new Producer({ setting });
        this._producer.on(Events.WAITING, (event) => {
            log.info(`${Events.WAITING} ${event.options.data.jobId}`, { component: components.JOBS_PRODUCER, jobId: event.options.data.jobId, status: States.WAITING });
        }).on(Events.ACTIVE, (event) => {
            log.info(`${Events.ACTIVE} ${event.options.data.jobId}`, { component: components.JOBS_PRODUCER, jobId: event.options.data.jobId, status: States.ACTIVE });
        }).on(Events.COMPLETED, (event) => {
            log.info(`${Events.COMPLETED} ${event.options.data.jobId}`, { component: components.JOBS_PRODUCER, jobId: event.options.data.jobId, status: States.COMPLETED });
        }).on(Events.FAILED, (event) => {
            log.error(`${Events.FAILED} ${event.options.data.jobId}, ${event.error}`, { component: components.JOBS_PRODUCER, jobId: event.options.data.jobId, status: States.FAILED });
        }).on(Events.STALLED, (event) => {
            log.error(`${Events.STALLED} ${event.options.data.jobId}, ${event.error}`, { component: components.JOBS_PRODUCER, jobId: event.options.data.jobId, status: States.STALLED });
        }).on(Events.CRASHED, async (event) => {
            log.error(`${Events.CRASHED} ${event.options.data.jobId}`, { component: components.JOBS_PRODUCER, jobId: event.options.data.jobId, status: States.FAILED });
            const pipeline = await stateManager.getExecution({ jobId: event.options.data.jobId });
            stateManager.setJobStatus({ jobId: event.options.data.jobId, pipeline: pipeline.name, status: States.FAILED, error: event.error, level: levels.error.name });
        });
    }

    async createJob(options) {
        const opt = {
            job: {
                id: options.jobId,
                type: JOB_TYPE,
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

    async stopJob(options) {
        const option = {
            type: JOB_TYPE,
            jobID: options.jobId
        };
        return this._producer.stopJob(option);
    }
}

module.exports = new JobProducer();
