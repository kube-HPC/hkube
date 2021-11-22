const log = require('@hkube/logger').GetLogFromContainer();
const { nodeKind } = require('@hkube/consts');
const component = require('./consts/componentNames').OPERATOR;
const db = require('./helpers/db');
const etcd = require('./helpers/etcd');
const kubernetes = require('./helpers/kubernetes');
const algorithmBuildsReconciler = require('./reconcile/algorithm-builds');
const tensorboardReconciler = require('./reconcile/tensorboard');
const devenv = require('./reconcile/devenv');
const debugReconciler = require('./reconcile/algorithm-debug');
const algorithmQueueReconciler = require('./reconcile/algorithm-queue');
const gatewaysReconciler = require('./reconcile/algorithm-gateway');
const driversReconciler = require('./reconcile/drivers-reconciler');
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

        if (options.isDevMode) {
            this._algorithmQueueDevMode({ options });
        }
        else {
            this._interval(options);
            this._boardsInterval(options);
        }
        this._driversSettings = this._prepareDriversData(options);
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
                this._devenvs(options),
                this._algorithmDebug(configMap, algorithms, options),
                this._algorithmQueue({ ...configMap, resources: options.resources.algorithmQueue }, algorithms, options, count),
                this._algorithmGateways({ ...configMap, algorithms }),
                this._pipelineDriversHandle(configMap, options)
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
        const maxAmount = Math.ceil(minAmount * scalePercent) + minAmount;
        return {
            minAmount, maxAmount, ...rest
        };
    }

    async _pipelineDriversHandle({ versions, registry, clusterOptions }, options) {
        const [driverTemplates, driversRequests, drivers, jobs] = await Promise.all([
            db.getDriversTemplate(),
            etcd.getPipelineDriverRequests(),
            etcd.getPipelineDrivers(),
            kubernetes.getPipelineDriversJobs()
        ]);

        await driversReconciler.reconcileDrivers({
            driverTemplates, driversRequests, drivers, jobs, versions, settings: this._driversSettings, registry, options, clusterOptions
        });
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

    async _devenvs(options) {
        if (!options.devenvs.enable) {
            return;
        }
        await devenv.reconcile({ ...options, clusterOptions: { ingressUseRegex: true } });
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

    async _algorithmDebug({ clusterOptions }, algorithms) {
        const services = await kubernetes.getServices({ labelSelector: `type=${nodeKind.Debug}` });
        const debugAlgorithms = algorithms.filter(a => a.kind === nodeKind.Debug);
        await debugReconciler.reconcile({
            services,
            debugAlgorithms,
            clusterOptions
        });
    }

    async _algorithmQueue({ versions, registry, clusterOptions, resources }, algorithms, options, count) {
        this._logAlgorithmCountError(algorithms, count);
        const { limit } = options.algorithmQueueBalancer;
        if (limit <= 0) {
            log.throttle.error(`algorithm queue concurrency limit must be positive number, got ${limit}`, { component });
            return;
        }
        const discovery = await etcd.getAlgorithmQueuesDiscovery();
        const deployments = await kubernetes.getDeployments({ labelSelector: `type=${CONTAINERS.ALGORITHM_QUEUE}` });
        await algorithmQueueReconciler.reconcile({
            deployments,
            algorithms,
            discovery,
            versions,
            registry,
            clusterOptions,
            resources,
            options
        });
    }

    async _algorithmQueueDevMode({ options }) {
        setInterval(async () => {
            if (this._isIntervalActive) {
                return;
            }
            try {
                this._isIntervalActive = true;
                const { algorithms } = await db.getAlgorithmTemplates();
                const discovery = await etcd.getAlgorithmQueuesDiscovery();

                await algorithmQueueReconciler.reconcileDevMode({
                    algorithms,
                    discovery,
                    options
                });
                await this._devenvs(options);
            }
            catch (e) {
                log.throttle.error(e, { component }, e);
            }
            finally {
                this._isIntervalActive = false;
            }
        }, this._intervalMs / 2);
    }

    async _algorithmGateways({ clusterOptions, algorithms }) {
        const services = await kubernetes.getServices({ labelSelector: `type=${nodeKind.Gateway}` });
        const gateways = algorithms.filter(a => a.kind === nodeKind.Gateway);
        await gatewaysReconciler.reconcile({
            services,
            gateways,
            clusterOptions
        });
    }

    _logAlgorithmCountError(algorithms, count) {
        if (algorithms.length < count) {
            log.throttle.error(`Only ${algorithms.length} algorithm-queue's can be created, but ${count} algorithms are defined. Please delete unused algorithms`, { component });
        }
    }
}

module.exports = new Operator();
