const log = require('@hkube/logger').GetLogFromContainer();
const levels = require('@hkube/logger').Levels;
const { tracer } = require('@hkube/metrics');
const { Producer, Events } = require('@hkube/producer-consumer');
const stateManager = require('../state/state-manager');
const component = require('../../lib/consts/componentNames').JOBS_PRODUCER;
const States = require('../state/States');

class JobProducer {
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
        this._producer.on(Events.WAITING, (event) => {
            log.info(`${Events.WAITING} ${event.options.data.jobId}`, { component, jobId: event.options.data.jobId, status: States.WAITING });
        }).on(Events.ACTIVE, (event) => {
            log.info(`${Events.ACTIVE} ${event.options.data.jobId}`, { component, jobId: event.options.data.jobId, status: States.ACTIVE });
        }).on(Events.COMPLETED, (event) => {
            log.info(`${Events.COMPLETED} ${event.options.data.jobId}`, { component, jobId: event.options.data.jobId, status: States.COMPLETED });
        }).on(Events.FAILED, (event) => {
            log.error(`${Events.FAILED} ${event.options.data.jobId}, ${event.error}`, { component, jobId: event.options.data.jobId, status: States.FAILED });
        }).on(Events.STALLED, (event) => {
            log.error(`${Events.STALLED} ${event.options.data.jobId}, ${event.error}`, { component, jobId: event.options.data.jobId, status: States.STALLED });
        }).on(Events.CRASHED, async (data) => {
            const { jobId, error } = data;
            const status = States.FAILED;
            log.error(`${Events.CRASHED} ${jobId}`, { component, jobId, status });
            const pipeline = await stateManager.getExecution({ jobId });
            stateManager.setJobStatus({ jobId, pipeline: pipeline.name, status, error, level: levels.ERROR.name });
            stateManager.setJobResults({ jobId, pipeline: pipeline.name, status, error, startTime: pipeline.startTime });
        });
    }

    async createJob(options) {
        const opt = {
            job: {
                id: options.jobId,
                type: this._jobType,
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
            type: this._jobType,
            jobId: options.jobId
        };
        return this._producer.stopJob(option);
    }
}

module.exports = new JobProducer();
