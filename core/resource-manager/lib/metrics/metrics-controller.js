const metricTypes = require('./index');
const utils = require('../utils/utils');
const logger = require('../utils/logger');
const metricsReducer = require('../metrics/metrics-reducer');
const MAX_SCORE = 1;

class MetricsController {
    constructor(config, settings) {
        this._metrics = {};
        this._config = config;
        this._settings = settings;
        Object.keys(metricTypes).forEach((k) => {
            this._metrics[k] = [];
        });
    }

    async init() {
        Object.entries(metricTypes).map(([k, v]) => this._initMetric(k, v));
    }

    _initMetric(type, collection) {
        let score = 0;
        Object.entries(collection)
            .filter(([name]) => utils.filterEnable(this._settings, name, type))
            .forEach(([name, Metric]) => {
                const setting = this._settings[type][name];
                const options = {
                    name,
                    setting,
                    config: this._config
                };
                const metric = new Metric(options);
                this._metrics[type].push(metric);
                score += metric.weight;
            });
        score = parseFloat(score.toFixed(2));
        if (score !== MAX_SCORE) {
            throw new Error(`metrics total score must be equal to ${MAX_SCORE}, current ${score}`);
        }
    }

    run(adaptersResults) {
        const results = Object.create(null);
        Object.entries(this._metrics).forEach(([type, metrics]) => {
            const metricsResults = metrics.map(m => ({ name: m.name, weight: m.weight, data: this._calc(m, type, adaptersResults) }));
            const resourceResults = metricsReducer.reduce(metricsResults);
            results[type] = resourceResults;
        });
        return results;
    }

    _calc(metric, type, adaptersResults) {
        let result;
        try {
            result = metric.calc(adaptersResults);
        }
        catch (error) {
            if (metric.mandatory) {
                throw new Error(`unable to calc metric ${metric.name} in ${type}, ${error.message}`);
            }
            else {
                logger.log(error, metric.name);
            }
        }
        return result;
    }
}

module.exports = MetricsController;
