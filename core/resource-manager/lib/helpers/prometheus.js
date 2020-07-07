const log = require('@hkube/logger').GetLogFromContainer();
const client = require('@hkube/prometheus-client');
const component = require('../consts/components').PROMETHEUS_ADAPTER;

const PROM_SETTINGS = {
    STEP: 14
};

class Prometheus {
    init(options) {
        if (!options.prometheus || !options.prometheus.endpoint) {
            log.warning('not initialized. connection is empty', { component });
            this._isInit = false;
            return;
        }
        client.init(options.prometheus);
    }

    async range(hours, queries) {
        const now = Date.now();
        const hoursBefore = new Date(now - (hours * 60 * 60 * 1000));
        const start = hoursBefore / 1000;
        const end = now / 1000;
        const step = PROM_SETTINGS.STEP * hours;
        return Promise.all(queries.map(q => client.range({ query: q.query, start, end, step })));
    }
}

module.exports = new Prometheus();
