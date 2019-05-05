const log = require('@hkube/logger').GetLogFromContainer();
const component = require('../lib/consts/componentNames').OPERATOR;
const etcd = require('./helpers/etcd');
const kubernetes = require('./helpers/kubernetes');
const algorithmBuildsReconciler = require('./reconcile/algorithm-builds');
const workerDebugReconciler = require('./reconcile/algorithm-debug');
const algorithmQueueReconciler = require('./reconcile/algorithm-queue');
const CONTAINERS = require('./consts/containers');

class Operator {
    async init(options = {}) {
        this._intervalMs = options.intervalMs;
        this._interval = this._interval.bind(this);
        this._interval(options);
    }

    async _interval(options) {
        try {
            log.debug('Reconcile interval.', { component });
            const configMap = await kubernetes.getVersionsConfigMap();
            const algorithms = await etcd.getAlgorithmTemplates();
            await Promise.all([
                this._algorithmBuilds(configMap, options),
                this._algorithmDebug(configMap, algorithms, options),
                this._algorithmQueue(configMap, algorithms, options)
            ]);
        }
        catch (e) {
            log.throttle.error(e, { component });
        }
        finally {
            setTimeout(this._interval, this._intervalMs, options);
        }
    }

    async _algorithmBuilds({ versions, registry, clusterOptions }, options) {
        const jobs = await kubernetes.getJobs({ labelSelector: `type=${CONTAINERS.ALGORITHM_BUILDS}` });
        const builds = await etcd.getPendingBuilds();
        await algorithmBuildsReconciler.reconcile({
            builds,
            jobs,
            versions,
            registry,
            clusterOptions,
            options
        });
    }

    async _algorithmDebug({ versions, registry, clusterOptions }, algorithms, options) {
        const kubernetesKinds = await kubernetes.getAlgorithmForDebug({ labelSelector: `type=${CONTAINERS.ALGORITHM_DEBUG}` });
        const debugAlgorithms = algorithms.filter(a => a.options && a.options.debug === true);
        await workerDebugReconciler.reconcile({
            kubernetesKinds,
            algorithms: debugAlgorithms,
            versions,
            registry,
            clusterOptions,
            options
        });
    }

    async _algorithmQueue({ versions, registry, clusterOptions }, algorithms) {
        const deployments = await kubernetes.getDeployments({ labelSelector: `type=${CONTAINERS.ALGORITHM_QUEUE}` });
        await algorithmQueueReconciler.reconcile({
            deployments,
            algorithms,
            versions,
            registry,
            clusterOptions
        });
    }
}

module.exports = new Operator();
