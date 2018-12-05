const Etcd = require('@hkube/etcd');
const { Consumer } = require('@hkube/producer-consumer');

const etcdOptions = {
    protocol: 'http',
    host: process.env.ETCD_SERVICE_HOST || 'localhost',
    port: process.env.ETCD_SERVICE_PORT || 4001
};

const serviceName = 'worker-stub';

class WorkerStub {
    constructor(options) {
        const setting = {
            job: {
                type: options.type
            },
            setting: {
                prefix: 'algorithm-queue'
            }
        };
        const consumer = new Consumer(setting);
        consumer.on('job', (job) => {
            this._job = job;
        });
        consumer.register(setting);
        this._etcd = new Etcd();
        this._etcd.init({ etcd: etcdOptions, serviceName });
    }

    async done(jobId, taskId, result, error) {
        await this._etcd.tasks.setState({ jobId, taskId, result: result, status: 'active' });
        if (!error) {
            await this._etcd.tasks.setState({ jobId, taskId, result: result, status: 'succeed' });
            this._job.done();
        }
        else {
            await this._etcd.tasks.setState({ jobId, taskId, error: error.message, status: 'failed' });
            this._job.done(error);
        }
    }
}

module.exports = WorkerStub;