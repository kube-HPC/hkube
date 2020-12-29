const { Consumer } = require('@hkube/producer-consumer');
const { taskStatuses } = require('@hkube/consts');
const etcd = require('./etcd');
const delay = d => new Promise(r => setTimeout(r, d));
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
            job: { type, prefix },
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

        consumer.on('job', async job => {
            // download to the mounted directory - ENV var
            // update etcd
            // SUBSCRIBE to job done

            const { jobId, taskId, nodeName } = job.data;
            await etcd.set({
                jobId,
                taskId,
                nodeName,
                status: taskStatuses.ACTIVE,
            });
            await delay(2000);

            const storageInfo = await storageManager.hkube.put({
                jobId,
                taskId,
                data: [],
            });
            // after mount
            await etcd.update({
                jobId,
                taskId,
                nodeName,
                status: taskStatuses.STORING,
                result: 'some optional result',
            });

            await delay(2000);
            await etcd.update({
                jobId,
                taskId,
                nodeName,
                status: taskStatuses.SUCCEED,
            });
            // // onFail
            // await etcd.update({
            //     jobId,
            //     taskId,
            //     status: taskStatuses.FAILED,
            //     error: 'the reason i failed',
            // });

            job.done(); // send job done to redis
        });
    }
}

module.exports = new JobConsumer();
