const Adapter = require('../Adapter');
const prometheus = require('../../helpers/prometheus');
const median = require('median');
const Cache = require('../../cache/cache-provider');

const PROM_SETTINGS = {
    HOURS: 0.5
};

class PrometheusAdapter extends Adapter {
    constructor(options, name) {
        super(options, name);
        this._cache = new Cache({ key: this.name, maxAge: 1000 * 60 * 1 });
    }

    async getData() {
        const data = this._cache.get();
        if (data) {
            return data;
        }
        const resources = await this._getResources();
        const progress = [];
        const result = {};
        resources.progress.data.result.forEach(a => {
            const value = parseFloat(a.values[a.values.length - 1][1]);
            progress.push(value);
        });
        result.pipelinesProgress = median(progress);
        this._cache.set(result);
        return result;
    }

    async _getResources() {
        const [progress] = await prometheus.range(PROM_SETTINGS.HOURS, [{
            query: 'pipelines_progress_gauge{pipeline_name!~"", status="active"}'
        }]);
        return { progress };
    }
}

module.exports = PrometheusAdapter;
