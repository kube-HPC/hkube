const { Events } = require('@hkube/producer-consumer');
const producerSingleton = require('./producer-singleton');
const log = require('@hkube/logger').GetLogFromContainer();
const { componentName, jobState } = require('../consts');
const component = componentName.JOBS_PRODUCER;
const queueRunner = require('../queue-runner');
const persistence = require('../persistency/persistence');

class JobProducer {
    constructor() {
        // in order to verify that the active is not some job that was in stalled before 
        this._lastSentJob = null;
    }

    async init(options) {
        this._producer = producerSingleton.get;
        this.jobType = options.producer.jobType;
        this.bullQueue = this._producer._createQueue(this.jobType);
        this._producerEventRegistry();
        this._checkWorkingStatusInterval();
    }

    // should handle cases where there is currently not any active job and new job added to queue 
    _checkWorkingStatusInterval() {
        setInterval(async () => {
            const waitingCount = await this.bullQueue.getWaitingCount();
            if (waitingCount === 0 && queueRunner.queue.get.length > 0) {
                await this.createJob();
            }
        }, 1000);
    }

    getPendingAmount() {
        return this.bullQueue.getWaitingCount();
    }

    _producerEventRegistry() {
        this._producer.on(Events.WAITING, (data) => {
            log.info(`${Events.WAITING} ${data.jobID}`, { component, jobId: data.jobID, status: jobState.WAITING });
        }).on(Events.ACTIVE, async (data) => {
            log.info(`${Events.ACTIVE} ${data.jobID}`, { component, jobId: data.jobID, status: jobState.ACTIVE });
            // verify that not stalled job is the active one 
            if (data.jobID === this._lastSentJob) {
                await this.createJob();
            }
        }).on(Events.COMPLETED, (data) => {
            log.info(`${Events.COMPLETED} ${data.jobID}`, { component, jobId: data.jobID, status: jobState.COMPLETED });
        }).on(Events.FAILED, (data) => {
            log.error(`${Events.FAILED} ${data.jobID}, error: ${data.error}`, { component, jobId: data.jobId, status: jobState.FAILED });
        }).on(Events.STALLED, (data) => {
            log.error(`${Events.STALLED} ${data.jobID}, error: ${data.error}`, { component, jobId: data.jobId, status: jobState.STALLED });
        }).on(Events.CRASHED, async (event) => {
            log.error(`${Events.CRASHED} ${event.options.data.jobId}`, { component, jobId: event.options.data.jobId, status: jobState.FAILED });
            persistence.setJobStatus({ jobId: event.options.data.jobId, pipeline: event.options.data.pipelineName, status: jobState.FAILED, error: event.error, level: 'error' });
        });
    }

    _taskToProducerJob(pipeline) {
        return {
            job: {
                id: pipeline.jobId,
                type: this.jobType,
                data: {
                    jobId: pipeline.jobId,
                    pipelineName: pipeline.pipelineName
                }
            },
            tracing: {
                parent: pipeline.spanId,
                tags: {
                    jobID: pipeline.jobId,
                }
            }
        };
    }

    async createJob() {
        const pipeline = queueRunner.queue.tryPop();
        if (pipeline) {
            log.info(`pop new job ${pipeline.jobId}, calculated score: ${pipeline.score}`, { component });
            this._lastSentJob = pipeline.jobId;
            const job = this._taskToProducerJob(pipeline);
            await this._producer.createJob(job);
            await persistence.unWatchJobState({ jobId: pipeline.jobId });
        }
        else {
            log.info('queue is empty', { component });
        }
    }
}

module.exports = new JobProducer();
