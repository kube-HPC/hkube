const { Events } = require('@hkube/producer-consumer');
const producerSingleton = require('./producer-singleton');
const log = require('@hkube/logger').GetLogFromContainer();
const { tracer } = require('@hkube/metrics');
const metrics = require('@hkube/metrics');
const { jobPrefix, componentName, jobState, taskStatus } = require('../consts/index');
const queueRunner = require('../queue-runner');
const Etcd = require('@hkube/etcd');


// const options = {
//     id: node.taskId,
//     type: node.algorithmName,
//     data: {
//         jobID: this._jobId,
//         taskID: node.taskId,
//         input: node.input,
//         storage: node.storage,
//         node: node.nodeName,
//         batchIndex: node.batchIndex,
//         pipelineName: this._pipelineName,
//         extraData: node.extraData
//     }
// }

// const./consts/queue-events = {
//     jobID: 'uuid',
//     pipelineName: 'id',
//     priority: '1-5',
//     algorithmName: 'alg name',
//     taskId:'uuid'
//     batchPlace: '0-n',
// taskData: {
//     input: task.input
// },
//     calculated: {
//         score: '1-100',
//         latestScores: {},
//         entranceTime: 'date',
//     }// const./consts/queue-events = {
// } };


class JobProducer {
    constructor() {
        // in order to verify that the active is not some job that was in stalled before 
        this._lastSentJob = null;
        this._etcd = new Etcd();
    }
    async init(options) {
        const { etcd, serviceName } = options;
        await this._etcd.init({ etcd, serviceName });

        //  const setting = Object.assign({}, { redis: options.redis });
        // setting.tracer = tracer;
        this._producer = producerSingleton.get;
        this.bullQueue = this._producer._createQueue(options.algorithmType);
        //   this.bullQueue.getWaitingCount();
        this._producerEventRegistry();
        this._checkWorkingStatusInterval();
    }
    // should handle cases where there is currently not any active job and new job added to queue 
    _checkWorkingStatusInterval() {
        setInterval(async () => {
            const waitingCount = await this.bullQueue.getWaitingCount();
            //    const activeCount = await this.bullQueue.getActiveCount();
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
            log.info(`${Events.WAITING} ${data.jobID}`, { component: componentName.JOBS_PRODUCER, jobID: data.jobID, status: jobState.WAITING });
        });
        this._producer.on(Events.ACTIVE, async (data) => {
            log.info(`${Events.ACTIVE} ${data.jobID}`, { component: componentName.JOBS_PRODUCER, jobID: data.jobID, status: jobState.ACTIVE });
            // verify that not stalled job is the active one 
            if (data.jobID === this._lastSentJob) {
                await this.createJob();
            }
        });
        this._producer.on(Events.COMPLETED, (data) => {
            log.debug(`${Events.COMPLETED} ${data.jobID}`, { component: componentName.JOBS_PRODUCER, jobID: data.jobID, status: jobState.COMPLETED });
        });
        this._producer.on(Events.FAILED, (data) => {
            log.error(`${Events.FAILED} ${data.jobID}, error: ${data.error}`, { component: componentName.JOBS_PRODUCER, jobID: data.jobID, status: jobState.FAILED });
        });
        this._producer.on(Events.STALLED, (data) => {
            log.error(`${Events.STALLED} ${data.jobID}, error: ${data.error}`, { component: componentName.JOBS_PRODUCER, jobID: data.jobID, status: jobState.STALLED });
        });
        this._producer.on(Events.CRASHED, async (job) => {
            const { jobID, taskID } = job.options;
            const { error } = job;
            const status = taskStatus.CRASHED;
            await this._etcd.tasks.setState({ jobId: jobID, taskId: taskID, status, error });
            log.error(`${error} ${taskID}`, { component: componentName.JOBS_PRODUCER, jobID, status });
        });
    }

    _taskToProducerJob(task) {
        return {
            job: {
                id: task.taskId,
                type: task.algorithmName,
                data: {
                    jobID: task.jobID,
                    taskID: task.taskId,
                    input: task.taskData.input,
                    storage: task.storage,
                    info: task.info,
                    node: task.nodeName,
                    batchIndex: task.batchPlace,
                    pipelineName: task.pipelineName,
                    //  extraData: node.extraData
                }
            },
            tracing: {
                parent: task.spanId,
                tags: {
                    jobID: task.jobID,
                    taskID: task.taskId,
                }
            }
        };
    }


    async createJob(options) {
        const task = queueRunner.queue.tryPop();
        if (task) {
            log.info(`pop new task with taskId: ${task.taskId}`, { component: componentName.JOBS_PRODUCER });
            log.info(`calculated score: ${task.calculated.score}`, { component: componentName.JOBS_PRODUCER });
            this._lastSentJob = task.taskId;
            const job = this._taskToProducerJob(task);
            return this._producer.createJob(job);
        }

        log.info('queue is empty ', { component: componentName.JOBS_PRODUCER });


        // if (options.parentSpan) {
        // opt.tracing = {
        //     parent: options.parentSpan,
        //     parentRelationship: tracer.parentRelationships.follows
        // };
        //    }
    }
}

module.exports = new JobProducer();
