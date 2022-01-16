const EventEmitter = require('events');
const { Consumer } = require('@hkube/producer-consumer');
const log = require('@hkube/logger').GetLogFromContainer();
const { pipelineStatuses, taskStatuses } = require('@hkube/consts');
const { tracer } = require('@hkube/metrics');
const db = require('../persistency/db');
const { isCompletedState } = require('../utils/pipelineStatuses');
const taskAdapter = require('../tasks-adapter');
const component = require('../consts/component-name').JOBS_CONSUMER;

class JobConsumer extends EventEmitter {
    constructor(config) {
        super();
        const { options, algorithmName } = config;
        this._algorithmName = algorithmName;
        this._getWaitingJobs = config.getWaitingJobs;
        this._consumer = new Consumer({
            setting: {
                redis: options.redis,
                tracer,
                prefix: options.consumer.prefix
            }
        });
        this._consumer.on('job', async (job) => {
            await this._handleJob(job);
        });
        this._consumer.register({
            job: {
                type: algorithmName,
                concurrency: options.consumer.concurrency
            }
        });
        this._queueLogging = options.logging;
    }

    async stop() {
        if (this._consumer) {
            await this._consumer.close({ type: this._algorithmName });
            this._consumer = null;
        }
    }

    async pause() {
        try {
            await this._consumer.pause({ type: this._algorithmName });
            log.info('job consumer paused', { component });
        }
        catch (e) {
            log.error(`failed to pause consumer. ${e.message}`, { component });
        }
    }

    async removeInvalidJob(data) {
        const { status, jobId } = data;
        if (isCompletedState({ status })) {
            this._removeInvalidJob([{ jobId }]);
            await this._removeWaitingJobs({ jobId, status });
        }
    }

    _removeInvalidJob(jobs) {
        this.emit('jobs-remove', jobs);
    }

    removeInvalidTasks(data) {
        const { status, jobId, taskId } = data;
        if (status === pipelineStatuses.STOPPED) {
            this._removeInvalidJob([{ jobId, taskId }]);
        }
    }

    async _removeWaitingJobs({ jobId, status }) {
        const removeJob = async (job) => {
            try {
                await job.discard();
                await job.remove();
                return { removed: true };
            }
            catch (error) {
                return { removed: false, error: error.message };
            }
        };
        try {
            const waitingJobs = await this._getWaitingJobs();
            const pendingJobs = waitingJobs.filter(j => j.data?.jobId === jobId);
            const removeResults = await Promise.all(pendingJobs.map(removeJob));
            if (removeResults.length) {
                const failedToRemove = removeResults.filter(r => r.error);
                log.info(`job ${jobId} with state ${status}: removed ${pendingJobs.length} waiting tasks.`, { component });
                if (failedToRemove.length) {
                    log.warning(`${failedToRemove.length} failed to remove`, { component });
                }
            }
        }
        catch (error) {
            log.error(`Failed to remove pending jobs for jobId ${jobId}`, { component }, error);
        }
    }

    // TODO: Handle case of IO error
    async _handleJob(job) {
        let error;
        try {
            const { id, jobId, spanId } = job.data;
            const data = await db.getJobStatus({ jobId });
            const tasks = await db.getTasksById({ id, jobId });
            log.info(`job arrived with ${data.status} state for jobId ${jobId} and ${tasks.length} tasks`, { component, jobId });
            if (this._queueLogging.tasks) {
                tasks.forEach(t => log.info(`task ${t.taskId} enqueued. Status: ${t.status}`, { component, jobId, taskId: t.taskId }));
            }
            await db.updateTasks({ id, jobId, status: taskStatuses.QUEUED });

            if (isCompletedState({ status: data.status })) {
                this._removeInvalidJob([{ jobId }]);
            }
            else {
                this.queueTasksBuilder({ tasks, spanId });
            }
        }
        catch (e) {
            error = e.message;
        }
        finally {
            job.done(error);
        }
    }

    queueTasksBuilder({ tasks, spanId }) {
        const taskList = tasks.map(task => taskAdapter.adaptData({ task, spanId, length: tasks.length }));
        this.emit('jobs-add', taskList);
    }
}

module.exports = JobConsumer;
