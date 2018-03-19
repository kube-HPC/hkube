
const Metric = require('./Metric');
const BASE = 10;

class AlgorithmQueueMetric extends Metric {

    constructor(options) {
        super(options);
    }

    /**
     * This method 
     * 
     * @param {any} data 
     * 
     * @memberOf AlgorithmQueueMetric
     */
    calc(data) {
        // data.algorithmQueue.reduce((prev, cur) => {
        //     if (cur.alg in prev) {
        //         prev[cur.alg] += cur.data.score;
        //     }
        //     else {
        //         prev[cur.alg] = cur.data.score;
        //     }
        //     return prev;
        // }, avg);

        const calculated = data.algorithmQueue.map(q => {
            return {
                alg: q.algorithmName,
                batch: q.batchPlace,
                score: this.weight * BASE * q.calculated.score
            }
        });

        return calculated;

    }
}

module.exports = AlgorithmQueueMetric;