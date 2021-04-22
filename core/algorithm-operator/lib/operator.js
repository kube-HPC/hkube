const log = require('@hkube/logger').GetLogFromContainer();
const component = require('./consts/componentNames').OPERATOR;
const db = require('./helpers/db');
const kubernetes = require('./helpers/kubernetes');
const algorithmBuildsReconciler = require('./reconcile/algorithm-builds');
const tensorboardReconciler = require('./reconcile/tensorboard');
const workerDebugReconciler = require('./reconcile/algorithm-debug');
const algorithmQueueReconciler = require('./reconcile/algorithm-queue');
const CONTAINERS = require('./consts/containers');

class Operator {
    async init(options = {}) {
        this._intervalMs = options.intervalMs;
        this._boardsIntervalMs = options.boardsIntervalMs;
        this._boardTimeOut = options.boardTimeOut;
        this._interval = this._interval.bind(this);
        this._boardsInterval = this._boardsInterval.bind(this);
        this._lastIntervalTime = null;
        this._lastIntervalBoardTime = null;
        this._interval(options);
        this._boardsInterval(options);
    }

    checkHealth(maxDiff) {
        log.debug('health-checks');
        if (!this._lastIntervalTime || !this._lastIntervalBoardTime) {
            return true;
        }
        const diff = Date.now() - this._lastIntervalTime;
        log.debug(`diff = ${diff}`);
        const boardDiff = Date.now() - this._lastIntervalBoardTime;
        log.debug(`diff = ${boardDiff}`);
        return (diff < maxDiff && boardDiff < maxDiff);
    }

    async _interval(options) {
        this._lastIntervalTime = Date.now();
        try {
            log.debug('Reconcile interval.', { component });
            const configMap = await kubernetes.getVersionsConfigMap();
            const { algorithms, count } = await db.getAlgorithmTemplates();
            await Promise.all([
                this._algorithmBuilds({ ...configMap }, options),
                this._tensorboards({ ...configMap, boardTimeOut: this._boardTimeOut }, options),
                this._algorithmDebug(configMap, algorithms, options),
                this._algorithmQueue({ ...configMap, resources: options.resources.algorithmQueue }, algorithms, options, count),
            ]);
        }
        catch (e) {
            log.throttle.error(e.message, { component }, e);
        }
        finally {
            setTimeout(this._interval, this._intervalMs, options);
        }
    }

    async _boardsInterval(options) {
        this._lastIntervalBoardTime = Date.now();
        try {
            log.debug('Update board interval.', { component });
            await tensorboardReconciler.updateTensorboards();
        }
        catch (e) {
            log.throttle.error(e.message, { component }, e);
        }
        finally {
            setTimeout(this._boardsInterval, this._boardsIntervalMs, options);
        }
    }

    async _algorithmBuilds({ versions, registry, clusterOptions }, options) {
        const builds = await db.getBuilds();
        if (builds.length === 0) {
            return;
        }
        const jobs = await kubernetes.getJobs({ labelSelector: `type=${CONTAINERS.ALGORITHM_BUILDS}` });
        const secret = await kubernetes.getSecret({ secretName: 'docker-credentials-secret' }); // ? Maybe multiple secrets
        await algorithmBuildsReconciler.reconcile({
            builds,
            jobs,
            secret,
            versions,
            registry,
            clusterOptions,
            options,
        });
    }

    async _tensorboards({ versions, registry, clusterOptions, boardTimeOut }, options) {
        const boards = await db.getTensorboards();
        const deployments = await kubernetes.getDeployments({ labelSelector: `type=${CONTAINERS.TENSORBOARD}` });

        await tensorboardReconciler.reconcile({
            boards,
            deployments,
            versions,
            registry,
            clusterOptions,
            boardTimeOut,
            options,
        });
    }

    async _algorithmDebug({ versions, registry, clusterOptions }, algorithms, options) {
        const kubernetesKinds = await kubernetes.getAlgorithmForDebug({ labelSelector: `type=${CONTAINERS.ALGORITHM_DEBUG}` });
        const debugAlgorithms = algorithms.filter(a => a.options?.debug === true);
        await workerDebugReconciler.reconcile({
            kubernetesKinds,
            algorithms: debugAlgorithms,
            versions,
            registry,
            clusterOptions,
            options
        });
    }

    async _algorithmQueue({ versions, registry, clusterOptions, resources }, algorithms, options, count) {
        this._logAlgorithmCountError(algorithms, count);
        const deployments = await kubernetes.getDeployments({ labelSelector: `type=${CONTAINERS.ALGORITHM_QUEUE}` });
        await algorithmQueueReconciler.reconcile({
            deployments,
            algorithms,
            versions,
            registry,
            clusterOptions,
            resources,
            options
        });
    }

    _logAlgorithmCountError(algorithms, count) {
        if (algorithms.length < count) {
            log.throttle.error(`Only ${algorithms.length} algorithm-queue's can be created, but ${count} algorithms are defined. Please delete unused algorithms`, { component });
        }
    }
}

module.exports = new Operator();
