const EventEmitter = require('events');
const isEqual = require('lodash.isequal');
const log = require('@hkube/logger').GetLogFromContainer();
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
        this._queueId = queueId;
        await etcd.watchQueueActions({ queueId });
        etcd.onQueueAction((data) => {
            this._handleAction(data);
        });

        this._watch();
        const discovery = this.getDiscoveryData();
        await etcd.discoveryRegister({ data: discovery });
        this._discoveryInterval();
    }

    _discoveryInterval() {
        if (this._interval) {
            return;
        }
        this._interval = setInterval(async () => {
            if (this._isIntervalActive) {
                return;
            }
            try {
                this._isIntervalActive = true;
                const discovery = this.getDiscoveryData();
                if (!isEqual(discovery.algorithms, this._lastDiscoveryData)) {
                    this._lastDiscoveryData = discovery.algorithms;
                    await etcd.discoveryUpdate(discovery);
                }
            }
            catch (e) {
                log.throttle.error(`fail on discovery interval ${e}`, { component }, e);
            }
            finally {
                this._isIntervalActive = false;
            }
        }, 5000);
    }

    async _handleAction(data) {
        try {
            const { action, algorithmName } = data;
            if (!algorithmName) {
                log.throttle.error('job arrived without algorithm name', { component });
                return;
            }
            if (!action) {
                log.throttle.error('job arrived without action', { component });
                return;
            }
            const method = this._actions[action];
            if (!method) {
                log.throttle.error(`invalid action ${action}`, { component });
                return;
            }
            await method(algorithmName);
        }
        catch (e) {
            log.throttle.error(`error on handle job ${e}`, { component });
        }
    }

    async _addAction(algorithmName) {
        if (this._queues.size === this._options.algorithmQueueBalancer.limit) {
            log.throttle.warning(`max queues limit has been reached, total size: ${this._queues.size}`, { component });
            return;
        }
        const queue = this._queues.get(algorithmName);
        if (!queue) {
            const props = { options: this._options, algorithmName };
            const algorithmQueue = queueRunner.create(props);
            this._queues.set(algorithmName, algorithmQueue);
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
            log.info(`algorithm queue from type ${algorithmName} deleted`, { component });
        }
        else {
            log.warning(`algorithm queue from type ${algorithmName} not exists`, { component });
        }
    }

    getDiscoveryData() {
        const algorithms = Array.from(this._queues.keys());
        return { queueId: this._queueId, algorithms, timestamp: Date.now() };
    }

    _watch() {
        etcd.on('job-change', (data) => {
            this._queues.forEach(q => {
                q._consumer?.removeInvalidJob(data);
            });
        });
        etcd.on('exec-change', (data) => {
            this._queues.forEach(q => {
                q._consumer?.removeInvalidTasks(data);
            });
        });
    }
}

module.exports = new QueuesManager();
