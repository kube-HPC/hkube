const EventEmitter = require('events');
const { Consumer } = require('@hkube/producer-consumer');

const Etcd = require('@hkube/etcd');
const { tracer } = require('@hkube/metrics');
const metrics = require('@hkube/metrics');
const { jobPrefix } = require('../consts/index');
const queueRunner = require('../queue-runner');
// const../queue-runner { metricsNames } = require('../../common/consts/metricsNames');
const log = require('@hkube/logger').GetLogFromContainer();

// const consumedObject = {
//     jobID: 'jobID',
//     tasks: [
//         {
//             taskId: 'taskId',
//             input: 'input',
//             batchIndex: 'batchIndex' // number in the batch 
//         }
//     ],
//     pipelineName: 'pipelineName',
//     nodeName: 'nodeName',
//     priority: 'priority',
//     algorithmName: 'algorithmName'
//     options:{} 
// };

// const./consts/queue-events = {
//     jobID: 'uuid',
//     pipelineName: 'id',
//     priority: '1-5',
//     algorithmName: 'alg name',
//     nodeName: 'nodeName',
//     batchPlace: '0-n',
//     calculated: {
//         score: '1-100',
//         entranceTime: 'date',
//     }// const./consts/queue-events = {

// };


class JobConsumer extends EventEmitter {
    constructor() {
        super();
        this._consumer = null;
        this._options = null;
        this._job = null;
        this._active = false;
        this.etcd = new Etcd();
    }


    async init(options) {
        const { etcd, serviceName, algorithmType } = options;
        this._options = options;
        this.etcd.init({ etcd, serviceName });
        await this.etcd.jobState.watch();
       
        // this._registerMetrics();
        this._consumer = new Consumer({
            setting: {
                redis: options.redis,
                tracer,
                prefix: jobPrefix.JOB_PREFIX
            }
        });
        this._consumer.register({
            job: { type: algorithmType }
        });
        log.info(`registering for job ${JSON.stringify(options)}`);
        this._consumer.on('job', async job => {
            const data = await this.etcd.jobState.getState({ jobId: job.data.jobID });
            if (data && data.state == 'stop') {
                log.info(`Job arrived with state stop therefore will not added to queue : ${JSON.stringify(job.data.tasks.length)}`);
                queueRunner.queue.removeJobId(job.data.jobID);
            }
            else {
                log.info(`Job arrived with inputs amount: ${JSON.stringify(job.data.tasks.length)}`);
                this.queueTasksBuilder(job);
            }
        });

        this.etcd.jobState.on('change', data => {
            if (data && data.state == 'stop') {
                queueRunner.queue.removeJobId(data.jobId);
            }
        });
    }


    pipelineToQueueAdapter({ jobID, pipelineName, priority, nodeName, algorithmName, info, spanId }, task, initialBatchLength) {
        return {
            jobID,
            pipelineName,
            algorithmName,
            priority,
            info,
            spanId,
            storage: task.storage,
            nodeName,
            initialBatchLength,
            batchPlace: task.batchIndex || 1,
            taskId: task.taskID,
            taskData: {
                input: task.input
            },
            calculated: {
                latestScores: {},
                //  score: '1-100',
                entranceTime: Date.now(),
                enrichment: {}
            }
        };
    }

    queueTasksBuilder(job) {
        const { jobID, pipelineName, priority, nodeName, algorithmName, info, spanId } = job.data;
        const tasks = job.data.tasks.map(task => {
            return this.pipelineToQueueAdapter({ jobID, pipelineName, priority, nodeName, algorithmName, info, spanId }, task, job.data.tasks.length);
        });
        queueRunner.queue.add(tasks);
        job.done();
    }
}

module.exports = new JobConsumer();

