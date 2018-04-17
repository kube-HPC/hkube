const EventEmitter = require('events');
const { Consumer } = require('@hkube/producer-consumer');
const Logger = require('@hkube/logger');
const { tracer } = require('@hkube/metrics');
const metrics = require('@hkube/metrics');
const { jobPrefix } = require('../consts/index');
const queueRunner = require('../queue-runner');
// const../queue-runner { metricsNames } = require('../../common/consts/metricsNames');
let log;

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
    }


    async init(options) {
        log = Logger.GetLogFromContainer();
        this._options = options;

        // this._registerMetrics();
        this._consumer = new Consumer({
            setting: {
                redis: options.redis,
                tracer,
                prefix: jobPrefix.JOB_PREFIX
            }
        });
        this._consumer.register({
            job: { type: this._options.algorithmType }
        });
        log.info(`registering for job ${JSON.stringify(options)}`);
        this._consumer.on('job', job => {
            log.info(`Job arrived with inputs amount: ${JSON.stringify(job.data.tasks.length)}`);
            this.queueTasksBuilder(job);
        });
        // metrics.get(metricsNames.algorithm_started).inc({
        //     labelValues: {
        //         pipeline_name: job.data.pipeline_name,
        //         algorithm_name: this._options.jobConsumer.job.type
        //     }
        // });
        // metrics.get(metricsNames.algorithm_net).start({
        //     id: job.data.taskID,
        //     labelValues: {
        //         pipeline_name: job.data.pipeline_name,
        //         algorithm_name: this._options.jobConsumer.job.type
        //     }
        // });


        // this._unRegister();
    }


    pipelineToQueueAdapter({ jobID, pipelineName, priority, nodeName, algorithmName, info }, task, initialBatchLength) {
        return {
            jobID,
            pipelineName,
            algorithmName,
            priority,
            info,
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
        const { jobID, pipelineName, priority, nodeName, algorithmName, info } = job.data;
        const tasks = job.data.tasks.map(task => {
            return this.pipelineToQueueAdapter({ jobID, pipelineName, priority, nodeName, algorithmName, info }, task, job.data.tasks.length);
        });
        queueRunner.queue.add(tasks);
        job.done();
    }
}

module.exports = new JobConsumer();

