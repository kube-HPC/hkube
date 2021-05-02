const EventEmitter = require('events');
const { Consumer } = require('@hkube/producer-consumer');
const log = require('@hkube/logger').GetLogFromContainer();
const Etcd = require('@hkube/etcd');
const { tracer } = require('@hkube/metrics');
const queueRunner = require('../queue-runner');
const component = require('../consts/component-name').JOBS_CONSUMER;

class ConsumerQueues extends EventEmitter {
    constructor() {
        super();
        this._options = null;
        this._queues = new Map();
    }

    async init(options) {
        this._options = options;
        const { queueId } = options;
        const consumer = new Consumer({
            setting: {
                redis: options.redis,
                prefix: options.consumer.prefix,
                tracer,
            }
        });
        consumer.on('job', (job) => {
            this._handleJob(job);
        });
        consumer.register({
            job: {
                type: queueId,
                concurrency: options.consumer.concurrency
            }
        });
        await this._watch(options);
        await this._etcd.discovery.register({ data: { queueId } });
    }

    async _handleJob(job) {
        try {
            const { algorithmName } = job.data;
            log.info(`job arrived for algorithm ${algorithmName}`, { component });
            const queue = this._queues.get(algorithmName);
            if (!queue) {
                const algorithmQueue = queueRunner.create(algorithmName);
                this._queues.set(algorithmName, algorithmQueue);
                await this.updateRegisteredData();
            }
            else {
                log.warning(`algorithm queue from type ${algorithmName} already exists`, { component });
            }
        }
        catch (error) {
            job.done(error);
        }
        finally {
            job.done();
        }
    }

    async updateRegisteredData() {
        const algorithms = Array.from(this._queues.keys());
        await this._etcd.discovery.updateRegisteredData({ algorithms });
    }

    async _watch(options) {
        this._etcd = new Etcd({ ...options.etcd, serviceName: options.serviceName });
        await this._etcd.jobs.status.watch();
        await this._etcd.algorithms.executions.watch();
        this._etcd.jobs.status.on('change', async (data) => {
            this._queues.forEach(q => {
                q.removeInvalidJob(data);
            });
        });
        this._etcd.algorithms.executions.on('change', (data) => {
            this._queues.forEach(q => {
                q.removeInvalidTasks(data);
            });
        });
    }
}

module.exports = new ConsumerQueues();
