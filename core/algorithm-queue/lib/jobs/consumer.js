const EventEmitter = require('events');
const { Consumer } = require('@hkube/producer-consumer');
const Logger = require('@hkube/logger');
const { tracer } = require('@hkube/metrics');
const metrics = require('@hkube/metrics');
const {jobPrefix} = require('../consts/index');
const queueRunner = require('../queue-runner');
// const../queue-runner { metricsNames } = require('../../common/consts/metricsNames');
let log;

const consumedObject = {
    jobID: 'jobID',
    tasks: [
        {
            taskId: 'taskId',
            input: 'input',
            batchId: 'batchId' // number in the batch 
        }
    ],
    pipelineName: 'pipelineName',
    nodeName: 'nodeName',
    priority: 'priority',
    algorithmName: 'algorithmName'
};

// const./consts/queue-events = {
//     jobId: 'uuid',
//     pipelineName: 'id',
//     priority: '1-5',
//     algorithmName: 'alg name',
//     batchPlace: '0-n',
//     calculated: {
//         score: '1-100',
//         entranceTime: 'date',
//     }
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
        
        
        this._registerMetrics();
        this._consumer = new Consumer({
            redis: options.redis,
            tracer,
            prefix: jobPrefix.JOB_PREFIX
        });
        this._consumer.register(this.options.algorithmType);
        log.info(`registering for job ${JSON.stringify(this._options.jobConsumer.job)}`);
        this._consumer.on('job', job => {
            log.info(`Job arrived with inputs: ${JSON.stringify(job.data.input)}`);
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
                    
                    
    pipelineToQueueAdapter({jobId, pipelineName, priority}, task) {
        return {
            jobId,
            pipelineName,
            priority,  
            batchPlace: task.batchId,
            taskId: task.taskID,
            taskData: {
                input: task.input
            },
            calculated: {
                //  score: '1-100',
                //  entranceTime: 'date',
            }
        };
    }
    
    queueTasksBuilder(job) {
        const {jobId, pipelineName, priority} = job;
        const tasks = job.tasks.map(task => {
            return this.pipelineToQueueAdapter({jobId, pipelineName, priority}, task);
        });    
        queueRunner.queue.add(tasks);
    }
   
   
    async finishJob(result) {
        if (!this._job) {
            return;
        }
            
        await etcd.unwatch({ jobId: this._job.data.jobID });
        let error = result && result.error;
        if (error && error.message) {
            error = error.message;
        }
        const status = error ? 'failed' : 'succeed';
        metrics.get(metricsNames.algorithm_completed).inc({
            labelValues: {
                pipeline_name: this._job.data.pipeline_name,
                algorithm_name: this._options.jobConsumer.job.type
            }
        });
        metrics.get(metricsNames.algorithm_net).start({
            id: this._job.data.taskID,
            labelValues: {
                status
            }
        });
        log.info(`status: ${status}, error: ${error}`);
        await etcd.update({
            jobId: this._job.data.jobID, taskId: this._job.id, status, result, error
        });
        this._job.done(error, result);
        this._job = null;
    }
}
    
module.exports = new JobConsumer();
    
