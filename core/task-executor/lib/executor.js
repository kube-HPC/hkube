const Logger = require('@hkube/logger');
const { metrics } = require('@hkube/metrics');
const fs = require('fs');
const component = require('../common/consts/componentNames').EXECUTOR;
const { metricsNames } = require('../common/consts/metricsNames');
const etcd = require('./helpers/etcd');
const kubernetes = require('./helpers/kubernetes');
const reconciler = require('./reconcile/reconciler');
let log;

class Executor {
    async init(options = {}) {
        log = Logger.GetLogFromContainer();
        this._intervalMs = options.intervalMs || 3000;
        // just for local testing. to be removed
        const versionsFilePath = `${__dirname}/../versions.json`;
        if (fs.existsSync(versionsFilePath)) {
            this._versions = JSON.parse(fs.readFileSync(versionsFilePath));
        }

        metrics.removeMeasure(metricsNames.TASK_EXECUTOR_JOB_REQUESTS);
        this[metricsNames.TASK_EXECUTOR_JOB_REQUESTS] = metrics.addGaugeMeasure({
            name: metricsNames.TASK_EXECUTOR_JOB_REQUESTS,
            labels: ['algorithmName']
        });
        metrics.removeMeasure(metricsNames.TASK_EXECUTOR_JOB_CURRENT);
        this[metricsNames.TASK_EXECUTOR_JOB_CURRENT] = metrics.addGaugeMeasure({
            name: metricsNames.TASK_EXECUTOR_JOB_CURRENT,
            labels: ['algorithmName']
        });
        this._startInterval();
    }

    _startInterval() {
        setTimeout(this._intervalCallback.bind(this), this._intervalMs);
    }

    async _intervalCallback() {
        log.debug('Reconcile inteval.', { component });
        const versions = await kubernetes.getVersionsConfigMap() || this._versions;
        const algorithmRequests = await etcd.getAlgorithmRequests({});
        const algorithmPods = await etcd.getWorkers({});
        const jobs = await kubernetes.getWorkerJobs();
        // log.debug(`algorithmRequests: ${JSON.stringify(algorithmRequests, null, 2)}`, { component });
        // log.debug(`algorithmPods: ${JSON.stringify(algorithmPods, null, 2)}`, { component });
        // log.debug(`jobs: ${JSON.stringify(jobs, null, 2)}`, { component });
        const reconcilerResults = await reconciler.reconcile({
            algorithmRequests, algorithmPods, jobs, versions
        });
        Object.entries(reconcilerResults).forEach(([algorithmName, res]) => {
            this[metricsNames.TASK_EXECUTOR_JOB_REQUESTS].set({ value: res.required, labelValues: { algorithmName } });
            this[metricsNames.TASK_EXECUTOR_JOB_CURRENT].set({ value: res.actual, labelValues: { algorithmName } });
        });

        log.debug(`newConfig: ${JSON.stringify(reconcilerResults, null, 2)}`, { component });
        setTimeout(this._intervalCallback.bind(this), this._intervalMs);
    }
}

module.exports = new Executor();
