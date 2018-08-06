const metricTypes = require('./index');
const metricSettings = require('./settings');
const utils = require('../utils/utils');
const logger = require('../utils/logger');
const metricsReducer = require('../metrics/metrics-reducer');
const MAX_SCORE = 1;

class MetricsController {
    constructor() {
        this._metrics = {};
        Object.keys(metricTypes).forEach((k) => {
            this._metrics[k] = [];
        });
    }

    async init(options) {
        Object.entries(metricTypes).map(([k, v]) => this._initMetric(k, v, options));
    }

    _initMetric(type, collection, config) {
        let score = 0;
        Object.entries(collection)
            .filter(([name]) => utils.filterEnable(metricSettings, name, type))
            .forEach(([name, Metric]) => {
                const setting = metricSettings[type][name];
                const options = {
                    name,
                    setting,
                    config
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
            const metricsResults = metrics.map(m => ({ weight: m.weight, data: this._calc(m, type, adaptersResults) }));
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
                throw new Error(`unable to get data for ${metric.name} metric in ${type}, ${error.message}`);
            }
            else {
                logger.log(error, metric.name);
            }
        }
        return result;
    }
}

module.exports = new MetricsController();
