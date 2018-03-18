
const Metric = require('./Metric');
const orderBy = require('lodash.orderby');
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
        const avg = Object.create(null);
        let mergedQueue = [];
        data.algorithmQueue.forEach(q => {
            mergedQueue = mergedQueue.concat(q.data);
        });
        mergedQueue = orderBy(mergedQueue, q => q.calculated.score, 'desc');

        // data.algorithmQueue.reduce((prev, cur) => {
        //     if (cur.alg in prev) {
        //         prev[cur.alg] += cur.data.score;
        //     }
        //     else {
        //         prev[cur.alg] = cur.data.score;
        //     }
        //     return prev;
        // }, avg);

        mergedQueue = mergedQueue.map(q => {
            return {
                alg: q.algorithmName,
                batch: q.batchPlace,
                score: this.weight * BASE * q.calculated.score
            }
        });

        return mergedQueue;
    }
}

module.exports = AlgorithmQueueMetric;