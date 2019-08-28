const Etcd = require('@hkube/etcd');
const { Consumer } = require('@hkube/producer-consumer');

const etcdOptions = {
    protocol: 'http',
    host: process.env.ETCD_SERVICE_HOST || 'localhost',
    port: process.env.ETCD_SERVICE_PORT || 4001
};

const delay = d => new Promise(r => setTimeout(r, d));

const serviceName = 'worker-stub';


class WorkerStub {
    constructor(options, auto) {
        const setting = {
            job: {
                type: options.type
            },
            setting: {
                prefix: 'algorithm-queue'
            }
        };
        const consumer = new Consumer(setting);
        consumer.on('job', async (job) => {
            this._job = job;

            if (auto) {
                const jobId = job.data.jobId;
                job.data.tasks.forEach(async (task) => {
                    const { status, taskId } = task;
                    if (status === 'preschedule') {
                        this._job.done();
                        return;
                    }
                    await this._etcd.jobs.tasks.set({ jobId, taskId, status: 'active' });
                    await delay(200);
                    await this.done({ jobId, taskId, result: 42, status: 'succeed' });
                })
            }
        });
        consumer.register(setting);
        this._etcd = new Etcd({ ...etcdOptions, serviceName });
    }

    async done({ jobId, taskId, result, error, status }) {
        await this._etcd.jobs.tasks.set({ jobId, taskId, result, error, status });
        this._job && this._job.done(error);
    }
}

module.exports = WorkerStub;