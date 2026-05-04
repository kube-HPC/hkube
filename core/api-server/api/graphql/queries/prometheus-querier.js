const { default: axios } = require('axios');
const log = require('@hkube/logger').GetLogFromContainer();
const component = require('../../../lib/consts/componentNames').PROMETHEUS_QUERIER;

const HKUBE_SERVICES = [
    'algorithm-operator',
    'api-server',
    'artifacts-registry',
    'datasources-service',
    'gc-service',
    'pipeline-driver-queue',
    'resource-manager',
    'simulator',
    'sync-server',
    'task-executor',
    'trigger-service',
];

const HKUBE_3RD_PARTY = [
    'etcd',
    'mongodb',
    'redis',
];

class PrometheusQuerier {
    init(options) {
        this._enabled = options.healthMonitoring.enabled;
        if (!this._enabled) {
            log.info('Health monitoring feature is disabled', { component });
            return;
        }
        this._prometheusEndpoint = options.healthMonitoring.prometheusEndpoint;
        this._dataSourceToken = options.healthMonitoring.dataSourceToken;
        const { namespace } = options.kubernetes;
        this._serviceChecks = [
            ...HKUBE_SERVICES.map(name => ({
                serviceName: name,
                promQuery: `count(kube_pod_status_phase{phase="Running", namespace="${namespace}", pod=~"${name}.*"})`,
            })),
            ...HKUBE_3RD_PARTY.map(name => ({
                serviceName: name,
                promQuery: `count(kube_pod_status_phase{phase="Running", namespace="${namespace}", pod=~"^hkube-${name}.*"})`,
            })),
        ];
    }

    async getHealthMonitoring() {
        if (!this._enabled) {
            return [];
        }
        try {
            const results = (await Promise.all(
                this._serviceChecks.map(async ({ serviceName, promQuery }) => {
                    const response = await this._query(promQuery);
                    if (!response) {
                        return null;
                    }
                    const value = parseInt(response?.data?.result?.[0]?.value?.[1], 10);
                    const status = Number.isFinite(value) && value >= 1;
                    return { serviceName, status };
                })
            )).filter(Boolean);
            // null if there was an error with the query, true if all statuses are true, false otherwise
            const overallHealthStatus = results.length < this._serviceChecks.length ? null : results.every(r => r.status);
            return { services: results, overallHealthStatus };
        }
        catch (error) {
            log.error(`Health monitoring failed: ${error.message}`, { component });
            return [];
        }
    }

    async _query(promQuery) {
        try {
            log.debug(`querying prometheus endpoint=${this._prometheusEndpoint} query=${promQuery}`, { component });
            const response = await axios.get(`${this._prometheusEndpoint}/api/v1/query`, {
                params: { query: promQuery },
                headers: { Authorization: `Bearer ${this._dataSourceToken}` },
            });
            log.debug(`Prometheus response for query=${promQuery}: ${JSON.stringify(response.data)}`, { component });
            return response.data;
        }
        catch (error) {
            if (error.response?.status === 401) {
                this._enabled = false;
                log.error('Prometheus query rejected: unauthorized (401). Disabling health monitoring feature.', { component });
                throw error;
            }
            log.error(`Prometheus query failed for "${promQuery}": ${error.message}`, { component });
            return null;
        }
    }
}

module.exports = new PrometheusQuerier();
