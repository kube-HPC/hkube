const median = require('median');
const Adapter = require('../Adapter');
const prometheus = require('../../helpers/prometheus');

const PROM_SETTINGS = {
    HOURS: 120
};

class PrometheusAdapter extends Adapter {
    constructor(options) {
        super(options);
    }

    async _getData() {
        const resources = await this._getResources();
        const progress = [];
        const result = {};
        resources.progress.data.result.forEach(a => {
            const value = parseFloat(a.values[a.values.length - 1][1]);
            progress.push(value);
        });
        result.pipelinesProgress = median(progress);
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
