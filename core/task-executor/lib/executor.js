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
        metrics.removeMeasure(metricsNames.TASK_EXECUTOR_JOB_PAUSED);
        this[metricsNames.TASK_EXECUTOR_JOB_PAUSED] = metrics.addGaugeMeasure({
            name: metricsNames.TASK_EXECUTOR_JOB_PAUSED,
            labels: ['algorithmName']
        });
        this._intervalCallback();
    }

    _startInterval() {
        setTimeout(this._intervalCallback.bind(this), this._intervalMs);
    }

    async _intervalCallback() {
        try {
            const versions = await kubernetes.getVersionsConfigMap() || this._versions;
            const algorithmRequests = await etcd.getAlgorithmRequests({});
            const algorithmPods = await etcd.getWorkers({});
            const jobs = await kubernetes.getWorkerJobs();
            const resources = await kubernetes.getReourcesPerNode();
            const reconcilerResults = await reconciler.reconcile({
                algorithmRequests, algorithmPods, jobs, versions, resources
            });
            Object.entries(reconcilerResults).forEach(([algorithmName, res]) => {
                this[metricsNames.TASK_EXECUTOR_JOB_REQUESTS].set({ value: res.required, labelValues: { algorithmName } });
                this[metricsNames.TASK_EXECUTOR_JOB_CURRENT].set({ value: res.idle, labelValues: { algorithmName } });
                this[metricsNames.TASK_EXECUTOR_JOB_PAUSED].set({ value: res.paused, labelValues: { algorithmName } });
            });
            Object.entries(reconcilerResults).forEach(([alg, val]) => {
                const totalForAlg = Object.values(val).reduce((sum, current) => sum + current);
                if (totalForAlg) {
                    log.debug(`newConfig: ${alg} => ${JSON.stringify(val, null, 2)}`, { component });
                }
            });
        }
        catch (e) {
            log.error(e.message, { component }, e);
        }
        finally {
            setTimeout(this._intervalCallback.bind(this), this._intervalMs);
        }
    }
}

module.exports = new Executor();
