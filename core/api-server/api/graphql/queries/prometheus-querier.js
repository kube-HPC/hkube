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
        this._prometheusEndpoint = options.healthMonitoring.prometheusEndpoint;
        const { namespace } = options.kubernetes;
        this._serviceChecks = [
            ...HKUBE_SERVICES.map(name => ({
                serviceName: name,
                promQuery: `count(kube_pod_status_phase{phase="Running", namespace="${namespace}", pod=~"${name}.*"})`,
            })),
            ...HKUBE_3RD_PARTY.map(name => ({
                serviceName: name,
                promQuery: `count(kube_pod_status_phase{phase="Running", namespace="${namespace}", pod=~"${name}.*"})`,
            })),
        ];
    }

    async getHealthMonitoring() {
        if (!this._enabled) {
            return [];
        }
        const results = await Promise.all(
            this._serviceChecks.map(async ({ serviceName, promQuery }) => {
                const response = await this._query(promQuery);
                const value = parseInt(response?.data?.result?.[0]?.value?.[1], 10);
                const status = !Number.isNaN(value) && value >= 1;
                return { serviceName, status };
            })
        );
        return results;
    }

    async _query(promQuery) {
        try {
            log.info(`querying prometheus endpoint=${this._prometheusEndpoint} query=${promQuery}`, { component });
            const response = await axios.get(`${this._prometheusEndpoint}/api/v1/query`, {
                params: { query: promQuery },
            });
            return response.data;
        }
        catch (error) {
            log.error(`Prometheus query failed for "${promQuery}": ${error.message}`, { component });
            return null;
        }
    }
}

module.exports = new PrometheusQuerier();
