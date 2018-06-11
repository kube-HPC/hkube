const fs = require('fs');
const path = require('path');
const utils = require('../utils/utils');
const MAX_SCORE = 1;

class MetricsRunner {
    constructor(options) {
        this._metrics = {};
        this._init(options);
    }

    _init(options) {
        const folders = fs.readdirSync(path.join(__dirname)).map(name => path.join(__dirname, name)).filter(source => fs.lstatSync(source).isDirectory());
        folders.forEach(f => {
            let score = 0;
            const folder = path.basename(f);
            const type = utils.capitalize(folder);
            this._metrics[type] = [];
            const files = fs.readdirSync(path.join(__dirname, folder));
            files.forEach(fi => {
                const file = path.basename(fi, '.js');
                const name = utils.capitalize(file);
                const Metric = require(`./${folder}/${file}`);
                const metric = new Metric(options, name);
                score += metric.weight;
                this._metrics[type].push(metric);
            });
            score = parseFloat(score.toFixed(2));
            if (score !== MAX_SCORE) {
                throw new Error(`metrics total score must be equal to ${MAX_SCORE}, current ${score}`);
            }
        });
    }

    run(type, options) {
        return this._metrics[type].map(m => ({ name: m.name, weight: m.weight, data: m.calc(options) }));
    }
}

module.exports = MetricsRunner;
