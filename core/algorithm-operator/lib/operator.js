const Logger = require('@hkube/logger');
const { metrics } = require('@hkube/metrics');
const fs = require('fs');
const component = require('../lib/consts/componentNames').OPERATOR;
const { metricsNames } = require('../lib/consts/metricsNames');
const etcd = require('./helpers/etcd');
const kubernetes = require('./helpers/kubernetes');
const reconciler = require('./reconcile/reconciler');
const CONTAINERS = require('./consts/containers');
let log;

class Operator {
    async init(options = {}) {
        log = Logger.GetLogFromContainer();
        this._intervalMs = options.intervalMs || 3000;
        // just for local testing. to be removed
        const versionsFilePath = `${__dirname}/../versions.json`;
        if (fs.existsSync(versionsFilePath)) {
            this._versions = JSON.parse(fs.readFileSync(versionsFilePath));
        }

        metrics.removeMeasure(metricsNames.ALGORITHM_QUEUE_CREATED);
        this[metricsNames.ALGORITHM_QUEUE_CREATED] = metrics.addGaugeMeasure({
            name: metricsNames.ALGORITHM_QUEUE_CREATED,
            labels: ['algorithmName']
        });
        metrics.removeMeasure(metricsNames.ALGORITHM_QUEUE_REMOVED);
        this[metricsNames.ALGORITHM_QUEUE_REMOVED] = metrics.addGaugeMeasure({
            name: metricsNames.ALGORITHM_QUEUE_REMOVED,
            labels: ['algorithmName']
        });
        this._interval = this._interval.bind(this);
        this._interval(options);
    }

    async _interval(options) {
        try {
            log.debug('Reconcile interval.', { component });
            const configMap = await kubernetes.getVersionsConfigMap();
            await Promise.all([
                this._algorithmBuilds(configMap, options),
                this._algorithmQueue(configMap, options)
            ]);
        }
        catch (e) {
            log.throttle.error(e.message, { component });
        }
        finally {
            setTimeout(this._interval, this._intervalMs, options);
        }
    }

    async _algorithmBuilds({ versions, registry, clusterOptions }, options) {
        const builds = await etcd.getPendingBuilds();
        const jobs = await kubernetes.getJobs({ labelSelector: `type=${CONTAINERS.ALGORITHM_BUILDER}` });
        await reconciler.reconcileBuilds({
            builds,
            jobs,
            versions,
            registry,
            clusterOptions,
            options
        });
    }

    async _algorithmQueue({ versions, registry, clusterOptions }) {
        const deployments = await kubernetes.getDeployments({ labelSelector: `metrics-group=${CONTAINERS.ALGORITHM_QUEUE}` });
        const algorithms = await etcd.getAlgorithmTemplates();
        await reconciler.reconcile({
            deployments,
            algorithms,
            versions,
            registry,
            clusterOptions
        });
    }
}

module.exports = new Operator();
