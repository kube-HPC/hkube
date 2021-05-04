const EventEmitter = require('events');
const { Consumer } = require('@hkube/producer-consumer');
const log = require('@hkube/logger').GetLogFromContainer();
const { tracer } = require('@hkube/metrics');
const etcd = require('./persistency/etcd');
const queueRunner = require('./queue-runner');
const component = require('./consts/component-name').JOBS_CONSUMER;

class QueuesManager extends EventEmitter {
    constructor() {
        super();
        this._queues = new Map();
        this._actions = {
            add: (...args) => this._addAction(...args),
            remove: (...args) => this._removeAction(...args),
        };
    }

    async init(options) {
        const { queueId } = options;
        if (!queueId) {
            throw new Error('queueId is required');
        }
        this._options = options;
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
        this._watch();
        this._queueId = queueId;
        const discovery = this.getDiscoveryData();
        await etcd.discoveryRegister({ data: discovery });
    }

    async _handleJob(job) {
        try {
            const { action, algorithmName } = job.data;
            if (!algorithmName) {
                log.error('job arrived without algorithm name', { component });
                return;
            }
            if (!action) {
                log.error('job arrived without action', { component });
                return;
            }
            const method = this._actions[action];
            if (!method) {
                log.error(`invalid action ${action}`, { component });
                return;
            }
            await method(algorithmName);
        }
        catch (error) {
            job.done(error);
        }
        finally {
            job.done();
        }
    }

    async _addAction(algorithmName) {
        if (this._queues.size === this._options.algorithmQueueBalancer.limit) {
            log.warning(`max queues limit has been reached, total size: ${this._queues.size}`, { component });
            return;
        }
        const queue = this._queues.get(algorithmName);
        if (!queue) {
            const props = { options: this._options, algorithmName };
            const algorithmQueue = queueRunner.create(props);
            this._queues.set(algorithmName, algorithmQueue);
            await this.updateRegisteredData();
            await algorithmQueue.start(props);
            log.info(`algorithm queue from type ${algorithmName} created`, { component });
        }
        else {
            log.warning(`algorithm queue from type ${algorithmName} already exists`, { component });
        }
    }

    async _removeAction(algorithmName) {
        const queue = this._queues.get(algorithmName);
        if (queue) {
            queue.stop();
            this._queues.delete(algorithmName);
            await this.updateRegisteredData();
            log.info(`algorithm queue from type ${algorithmName} created`, { component });
        }
        else {
            log.warning(`algorithm queue from type ${algorithmName} not exists`, { component });
        }
    }

    async updateRegisteredData() {
        // const algorithms = ['gray-alg', 'white-alg'];
        const discovery = this.getDiscoveryData();
        await etcd.discoveryUpdate(discovery);
    }

    getDiscoveryData() {
        const algorithms = Array.from(this._queues.keys());
        return { queueId: this._queueId, algorithms, timestamp: Date.now() };
    }

    _watch() {
        etcd.on('job-change', (data) => {
            this._queues.forEach(q => {
                q.removeInvalidJob(data);
            });
        });
        etcd.on('exec-change', (data) => {
            this._queues.forEach(q => {
                q.removeInvalidTasks(data);
            });
        });
    }
}

module.exports = new QueuesManager();
