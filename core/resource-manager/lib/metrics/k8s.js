
const Metric = require('./Metric');

class K8sMetric extends Metric {

    constructor(options) {
        super(options);
    }

    calc(data) {
        const algorithmQueue = data.algorithmQueue.map(q => {
            return {
                ...q,
                score: this.weight * q.score
            }
        });
        const result = {
            ...data,
            algorithmQueue
        }
        return result;
    }
}

module.exports = K8sMetric;