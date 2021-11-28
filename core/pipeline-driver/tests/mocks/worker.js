const { Consumer } = require('@hkube/producer-consumer');
const delay = d => new Promise(r => setTimeout(r, d));
let stateManager;

class WorkerStub {
    constructor(options, auto) {
        if (!stateManager) {
            stateManager = require('../../lib/state/state-manager');
        }
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
                const { jobId, nodeName } = job.data;
                job.data.tasks.forEach(async (task) => {
                    const { status, taskId } = task;
                    if (status === 'preschedule') {
                        this._job.done();
                        return;
                    }
                    await stateManager.updateTask({ jobId, taskId, status: 'active', nodeName });
                    await delay(200);
                    await this.done({ jobId, taskId, result: 42, status: 'succeed', nodeName });
                })
            }
        });
        consumer.register(setting);
    }

    async done({ jobId, taskId, result, error, status, nodeName, batchIndex }) {
        await stateManager.updateTask({ jobId, taskId, result, error, status, nodeName, batchIndex });
        this._job && this._job.done(error);
    }
}

module.exports = WorkerStub;