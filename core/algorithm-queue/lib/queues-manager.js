const EventEmitter = require('events');
const isEqual = require('lodash.isequal');
const log = require('@hkube/logger').GetLogFromContainer();
const etcd = require('./persistency/etcd');
const queueRunner = require('./queue-runner');
const component = require('./consts/component-name').JOBS_CONSUMER;

class QueuesManager extends EventEmitter {
    constructor() {
        super();
        this._active = true;
        this._lastActive = Date.now();
        this._queues = new Map();
        this._actions = {
            add: (...args) => this._addAction(...args),
            remove: (...args) => this._removeAction(...args, 'deleted', true),
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
        const discovery = this._getDiscoveryData();
        await etcd.discoveryRegister({ data: discovery });
        this._livenessInterval();
        log.info(`queue ${queueId} is up and running`, { component });
    }

    /**
     * This method is responsible for updating the discovery data.
     * and also doing self preparation for graceful shutdown.
     */
    _livenessInterval() {
        setTimeout(async () => {
            try {
                const { queueId, algorithms } = this._getDiscoveryData();
                if (algorithms.length === 0) {
                    const idleTime = Date.now() - this._lastActive;
                    const isIdle = idleTime > this._options.algorithmQueueBalancer.minIdleTimeMS;
                    if (isIdle && this._active) {
                        this._active = false;
                        log.info(`queue ${queueId} is idle for ${(idleTime / 1000).toFixed(0)} sec, preparing for shutdown`, { component });
                        await etcd.unWatchQueueActions({ queueId });
                    }
                }
                else {
                    await this._checkIdleAlgorithms();
                    this._lastActive = Date.now();
                }
                await this._discoveryUpdate();
            }
            catch (e) {
                log.throttle.error(`fail on discovery interval ${e}`, { component }, e);
            }
            finally {
                this._livenessInterval();
            }
        }, this._options.algorithmQueueBalancer.livenessInterval);
    }

    /**
     * This method is responsible for removing staled queues.
     * stale queue is a queue which idle for X time and also empty and paused.
     */
    async _checkIdleAlgorithms() {
        const queues = Array.from(this._queues.values());
        const isIdle = queues.filter(q => q.isIdle());
        const isStaled = queues.filter(q => q.isStaled());
        await Promise.all(queues.map(a => a.checkIdle()));
        await Promise.all(isIdle.map(q => q.pause()));
        await Promise.all(isStaled.map(async q => {
            try {
                await this._removeAction(q.algorithmName, 'idle', false);
            }
            catch (e) {
                log.throttle.error(`error removing idle queue ${q.algorithmName} ${e.message}`, { component }, e);
            }
        }));
    }

    async _handleAction(data) {
        try {
            if (!this._active) {
                log.throttle.error('queue is not active', { component });
                return;
            }
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

    async _removeAction(algorithmName, reason, force) {
        const queue = this._queues.get(algorithmName);
        if (queue) {
            await queue.stop(force);
            this._queues.delete(algorithmName);
            log.info(`algorithm queue from type ${algorithmName} deleted. reason: ${reason}`, { component });
        }
        else {
            log.warning(`algorithm queue from type ${algorithmName} not exists`, { component });
        }
    }

    async _discoveryUpdate() {
        const discovery = this._getDiscoveryData();
        if (!isEqual(discovery, this._lastDiscoveryData)) {
            this._lastDiscoveryData = discovery;
            await etcd.discoveryUpdate({ ...discovery, timestamp: Date.now() });
        }
    }

    _getDiscoveryData() {
        const algorithms = Array.from(this._queues.keys());
        return { queueId: this._queueId, algorithms, active: this._active };
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
