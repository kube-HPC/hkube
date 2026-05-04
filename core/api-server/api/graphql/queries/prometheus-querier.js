const { default: axios } = require('axios');
const log = require('@hkube/logger').GetLogFromContainer();
const component = require('../../../lib/consts/componentNames').PROMETHEUS_QUERIER;

const PROMETHEUS_FIRST_RESULT_INDEX = 0; // count() always returns a single result series
const PROMETHEUS_SAMPLE_VALUE_INDEX = 1; // Prometheus value tuple: [timestamp, sampleValue]

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
        this._disabledUntil = null;
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
        this._disabledResponse = {
            services: this._serviceChecks.map(({ serviceName }) => ({ serviceName, status: null })),
            overallHealthStatus: null,
        };
        if (!this._enabled) {
            log.info('Health monitoring feature is disabled', { component });
            return;
        }
        this._prometheusEndpoint = options.healthMonitoring.prometheusEndpoint;
        this._dataSourceToken = options.healthMonitoring.dataSourceToken;
        this._errorCooldownMs = options.healthMonitoring.errorCooldownMinutes * 60 * 1000;
    }

    async getHealthMonitoring() {
        if (!this._enabled) {
            return this._disabledResponse;
        }
        if (this._disabledUntil !== null) {
            if (Date.now() < this._disabledUntil) {
                log.info(`Health monitoring temporarily disabled for ${Math.ceil((this._disabledUntil - Date.now()) / 60000)} more minute(s)`, { component });
                return this._disabledResponse;
            }
            this._disabledUntil = null;
        }
        try {
            const results = (await Promise.all(
                this._serviceChecks.map(async ({ serviceName, promQuery }) => {
                    const response = await this._query(promQuery);
                    if (!response) {
                        return { serviceName, status: null };
                    }
                    const value = parseInt(response?.data?.result?.[PROMETHEUS_FIRST_RESULT_INDEX]?.value?.[PROMETHEUS_SAMPLE_VALUE_INDEX], 10);
                    const status = Number.isFinite(value) && value >= 1;
                    return { serviceName, status };
                })
            ));
            const overallHealthStatus = results.some(r => r.status === null) ? null : results.every(r => r.status);
            return { services: results, overallHealthStatus };
        }
        catch (error) {
            log.error(`Health monitoring failed: ${error.message}`, { component });
            return this._disabledResponse;
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
                if (this._enabled) {
                    this._enabled = false;
                    log.error('Prometheus query rejected: unauthorized (401). Disabling health monitoring permanently.', { component });
                }
            }
            else if (this._disabledUntil === null) {
                this._disabledUntil = Date.now() + this._errorCooldownMs;
                log.error(`Prometheus query failed for "${promQuery}": ${error.message}. Disabling health monitoring for ${this._errorCooldownMs / 60000} minutes.`, { component });
            }
            else { // already disabled, just log the error without spamming with disable messages
                log.error(`Prometheus query failed for "${promQuery}": ${error.message}`, { component });
            }
            return null;
        }
    }
}

module.exports = new PrometheusQuerier();
