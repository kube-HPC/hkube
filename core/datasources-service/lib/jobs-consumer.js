const { Consumer } = require('@hkube/producer-consumer');
const { taskStatuses } = require('@hkube/consts');
const { etcd } = require('../config/main/config.base');

class JobConsumer {
    constructor() {
        this._inactiveTimer = null;
    }

    /**
     * Init the consumer and register for jobs
     *
     * @param {any} options
     */
    init(options) {
        const { type, prefix } = options.jobs.consumer;
        const option = {
            job: { type },
            setting: {
                redis: options.redis,
                prefix,
            },
        };

        const consumer = new Consumer(option);
        consumer.register(option);
        // data: {
        //     jobId,
        //     taskId: options.node.taskId,
        //     dataSource: options.node.dataSource
        // }

        // dataSource:
        // snapshotId:  <string> ---> saved
        // -----------
        // name: string
        // version?: string
        // query?: string

        consumer.on('job', job => {
            // download to the mounted directory - ENV var
            // update etcd
            // SUBSCRIBE to job done

            job.done(); // send job done to redis
            const { jobId, taskId } = job;
            etcd.jobs.tasks.update({
                jobId,
                taskId,
                status: taskStatuses.ACTIVE,
            });
            // after mount
            etcd.jobs.tasks.update({
                jobId,
                taskId,
                status: taskStatuses.SUCCEED,
                result: 'some optional result',
            });
            // onFail
            etcd.jobs.tasks.update({
                jobId,
                taskId,
                status: taskStatuses.FAILED,
                error: 'the reason i failed',
            });
        });
    }
}

module.exports = new JobConsumer();
