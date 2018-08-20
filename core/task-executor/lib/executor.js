const Logger = require('@hkube/logger');
const { metrics } = require('@hkube/metrics');
const component = require('../common/consts/componentNames').EXECUTOR;
const { metricsNames } = require('../common/consts/metricsNames');
const etcd = require('./helpers/etcd');
const utils = require('./utils/utils');
const logger = require('./utils/logger');
const kubernetes = require('./helpers/kubernetes');
const reconciler = require('./reconcile/reconciler');
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
        this._interval = this._interval.bind(this);
        const driversData = this._prepareDriversData(options);
        this._interval(options, driversData);
    }

    async _interval(options, driversData) {
        try {
            const [{ versions, registry }, resources] = await Promise.all([
                kubernetes.getVersionsConfigMap(),
                kubernetes.getResourcesPerNode()
            ]);

            const normResources = normalizeResources(resources);
            const data = { 
                versions, normResources, options, registry 
            };

            await Promise.all([
                this._algorithmsHandle(data),
                this._pipelineDriversHandle(data, driversData)
            ]);
        }
        catch (e) {
            logger.log(e, component);
        }
        finally {
            setTimeout(this._interval, this._intervalMs, options, driversData);
        }
    }

    _prepareDriversData(options) {
        const { minAmount, scalePercent, name } = options.driversSetting;
        const maxAmount = (minAmount * scalePercent) + minAmount;
        return { minAmount, maxAmount, name };
    }

    async _algorithmsHandle({ versions, normResources, registry }) {
        const [templates, algorithmRequests, algorithmPods, jobs] = await Promise.all([
            etcd.getAlgorithmTemplate(),
            etcd.getAlgorithmRequests({}),
            etcd.getWorkers({}),
            kubernetes.getWorkerJobs()
        ]);

        const algorithmTemplates = utils.arrayToMap(templates);

        const reconcilerResults = await reconciler.reconcile({
            algorithmTemplates, algorithmRequests, algorithmPods, jobs, versions, normResources, registry
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

    async _pipelineDriversHandle({ versions, normResources, registry }, settings) {
        const [templates, driversRequests, driversPods, jobs] = await Promise.all([
            etcd.getDriversTemplate(),
            etcd.getPipelineDriverRequests(),
            etcd.getPipelineDrivers(),
            kubernetes.getPipelineDriversJobs()
        ]);

        const driverTemplates = utils.arrayToMap(templates, 'name');

        await reconciler.reconcileDrivers({
            driverTemplates, driversRequests, driversPods, jobs, versions, normResources, settings, registry
        });
    }
}

module.exports = new Executor();
