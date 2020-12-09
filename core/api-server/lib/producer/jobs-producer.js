const log = require('@hkube/logger').GetLogFromContainer();
const levels = require('@hkube/logger').Levels;
const { pipelineStatuses } = require('@hkube/consts');
const { tracer } = require('@hkube/metrics');
const { Producer, Events } = require('@hkube/producer-consumer');
const stateManager = require('../state/state-manager');
const component = require('../consts/componentNames').JOBS_PRODUCER;

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
            log.info(`${Events.WAITING} ${event.options.data.jobId}`, { component, jobId: event.options.data.jobId, status: Events.WAITING });
        }).on(Events.ACTIVE, (event) => {
            log.info(`${Events.ACTIVE} ${event.options.data.jobId}`, { component, jobId: event.options.data.jobId, status: Events.ACTIVE });
        }).on(Events.COMPLETED, (event) => {
            log.info(`${Events.COMPLETED} ${event.options.data.jobId}`, { component, jobId: event.options.data.jobId, status: Events.COMPLETED });
        }).on(Events.FAILED, (event) => {
            log.error(`${Events.FAILED} ${event.options.data.jobId}, ${event.error}`, { component, jobId: event.options.data.jobId, status: Events.FAILED });
        }).on(Events.STALLED, (event) => {
            log.error(`${Events.STALLED} ${event.options.data.jobId}, ${event.error}`, { component, jobId: event.options.data.jobId, status: Events.STALLED });
        }).on(Events.CRASHED, async (data) => {
            const { jobId, error } = data;
            const status = pipelineStatuses.FAILED;
            log.error(`${Events.CRASHED} ${jobId}`, { component, jobId, status });
            const pipeline = await stateManager.getJobPipeline({ jobId });
            const statusObject = { jobId, status, error, level: levels.ERROR.name };
            const resultObject = { jobId, pipeline: pipeline.name, status, error, startTime: pipeline.startTime };
            await stateManager.updateJobStatus(statusObject);
            await stateManager.updateJobResult(resultObject);
        });
    }

    async createJob(options) {
        const opt = {
            job: {
                id: options.jobId,
                type: this._jobType,
                data: {
                    jobId: options.jobId,
                    maxExceeded: options.maxExceeded
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
