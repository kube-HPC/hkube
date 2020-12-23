const Logger = require('@hkube/logger');
const { metrics } = require('@hkube/metrics');
const { metricsNames, components } = require('./consts');
const component = components.EXECUTOR;
const etcd = require('./helpers/etcd');
const kubernetes = require('./helpers/kubernetes');
const reconciler = require('./reconcile/reconciler');
const driversReconciler = require('./reconcile/drivers-reconciler');
const { normalizeResources } = require('./reconcile/normalize');
let log;

class Executor {
    async init(options = {}) {
        log = Logger.GetLogFromContainer();
        this._intervalMs = options.intervalMs;

        metrics.removeMeasure(metricsNames.TASK_EXECUTOR_JOB_REQUESTS);
        this[metricsNames.TASK_EXECUTOR_JOB_REQUESTS] = metrics.addGaugeMeasure({
            name: metricsNames.TASK_EXECUTOR_JOB_REQUESTS,
            labels: ['algorithmName']
        });
        metrics.removeMeasure(metricsNames.TASK_EXECUTOR_JOB_PAUSED);
        this[metricsNames.TASK_EXECUTOR_JOB_PAUSED] = metrics.addGaugeMeasure({
            name: metricsNames.TASK_EXECUTOR_JOB_PAUSED,
            labels: ['algorithmName']
        });
        metrics.removeMeasure(metricsNames.TASK_EXECUTOR_JOB_RESUMED);
        this[metricsNames.TASK_EXECUTOR_JOB_RESUMED] = metrics.addGaugeMeasure({
            name: metricsNames.TASK_EXECUTOR_JOB_RESUMED,
            labels: ['algorithmName']
        });
        metrics.removeMeasure(metricsNames.TASK_EXECUTOR_JOB_SKIPPED);
        this[metricsNames.TASK_EXECUTOR_JOB_SKIPPED] = metrics.addGaugeMeasure({
            name: metricsNames.TASK_EXECUTOR_JOB_SKIPPED,
            labels: ['algorithmName']
        });
        metrics.removeMeasure(metricsNames.TASK_EXECUTOR_JOB_ACTIVE);
        this[metricsNames.TASK_EXECUTOR_JOB_ACTIVE] = metrics.addGaugeMeasure({
            name: metricsNames.TASK_EXECUTOR_JOB_ACTIVE,
            labels: ['algorithmName']
        });
        this._interval = this._interval.bind(this);
        this._driversSettings = this._prepareDriversData(options);
        this._lastIntervalTime = null;
        await this._interval(options);
    }

    checkHealth(maxDiff) {
        log.debug('health-checks');
        if (!this._lastIntervalTime) {
            return true;
        }
        const diff = Date.now() - this._lastIntervalTime;
        log.debug(`diff = ${diff}`);

        return (diff < maxDiff);
    }

    async _interval(options) {
        this._lastIntervalTime = Date.now();
        try {
            const [{ versions, registry, clusterOptions }, resources] = await Promise.all([
                kubernetes.getVersionsConfigMap(),
                kubernetes.getResourcesPerNode()
            ]);

            const { pods } = resources;
            const normResources = normalizeResources(resources);
            const data = {
                versions,
                normResources,
                options,
                registry,
                clusterOptions,
                pods,
                workerResources: options.resources.worker
            };

            await Promise.all([
                this._algorithmsHandle(data),
                this._pipelineDriversHandle(data)
            ]);
        }
        catch (e) {
            log.throttle.error(e.message, { component }, e);
        }
        finally {
            setTimeout(this._interval, this._intervalMs, options);
        }
    }

    _prepareDriversData(options) {
        const { minAmount, scalePercent, ...rest } = options.driversSetting;
        const maxAmount = (minAmount * scalePercent) + minAmount;
        return {
            minAmount, maxAmount, ...rest
        };
    }

    async _algorithmsHandle({ versions, normResources, registry, options, clusterOptions, pods, workerResources }) {
        const [algorithmTemplates, algorithmRequests, workers, jobs] = await Promise.all([
            etcd.getAlgorithmTemplate(),
            etcd.getAlgorithmRequests({}),
            etcd.getWorkers({}),
            kubernetes.getWorkerJobs()
        ]);

        const reconcilerResults = await reconciler.reconcile({
            algorithmTemplates, algorithmRequests, workers, jobs, pods, versions, normResources, registry, options, clusterOptions, workerResources
        });
        Object.entries(reconcilerResults).forEach(([algorithmName, res]) => {
            this[metricsNames.TASK_EXECUTOR_JOB_REQUESTS].set({ value: res.required || 0, labelValues: { algorithmName } });
            this[metricsNames.TASK_EXECUTOR_JOB_SKIPPED].set({ value: res.skipped || 0, labelValues: { algorithmName } });
            this[metricsNames.TASK_EXECUTOR_JOB_RESUMED].set({ value: res.resumed || 0, labelValues: { algorithmName } });
            this[metricsNames.TASK_EXECUTOR_JOB_PAUSED].set({ value: res.paused || 0, labelValues: { algorithmName } });
            this[metricsNames.TASK_EXECUTOR_JOB_ACTIVE].set({ value: res.active || 0, labelValues: { algorithmName } });
        });
    }

    async _pipelineDriversHandle({ versions, normResources, registry, options, clusterOptions }) {
        if (this._lastReconcileDrivers && Date.now() - this._lastReconcileDrivers < this._driversSettings.reconcileInterval) {
            return;
        }
        this._lastReconcileDrivers = Date.now();
        const [driverTemplates, driversRequests, drivers, jobs] = await Promise.all([
            etcd.getDriversTemplate(),
            etcd.getPipelineDriverRequests(),
            etcd.getPipelineDrivers(),
            kubernetes.getPipelineDriversJobs()
        ]);

        await driversReconciler.reconcileDrivers({
            driverTemplates, driversRequests, drivers, jobs, versions, normResources, settings: this._driversSettings, registry, options, clusterOptions
        });
    }
}

module.exports = new Executor();
