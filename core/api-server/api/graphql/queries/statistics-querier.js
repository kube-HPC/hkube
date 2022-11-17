const checkDiskSpace = require('check-disk-space').default;
const log = require('@hkube/logger').GetLogFromContainer();
const parse = require('@hkube/units-converter');
const DatabaseQuerier = require('./database-querier');
const INTERVAL = 10000;
const METRICS = ['cpu', 'mem', 'gpu'];
const component = 'NodesStatistics';

class NodesStatistics {
    constructor() {
        this._currentResults = [];
        this._lastIntervalTime = null;
    }

    init(options) {
        this._options = options;
        if (this._options.graphql.useIntervalForStatistics) {
            this.run();
        }
    }

    checkHealth(maxDiff) {
        log.debug('statistics health-checks');
        if (!this._lastIntervalTime) {
            return true;
        }
        const diff = Date.now() - this._lastIntervalTime;
        log.debug(`diff = ${diff}`);

        return (diff < maxDiff);
    }

    async _statisticsInterval() {
        this._lastIntervalTime = Date.now();
        try {
            this._currentResults = await this.getStatisticsResults();
            this._diskSpace = await this.getDiskUsage();
        }
        catch (error) {
            log.error(error.message, { component }, error);
        }
        this.run();
    }

    async getStatisticsResults() {
        try {
            const data = await this._getEtcdData();

            this._currentResults = this.buildResults(data);
            return this._currentResults;
        }
        catch (error) {
            log.error(error.message, { component }, error);
        }
        return [];
    }

    run() {
        setTimeout(() => {
            this._statisticsInterval();
        }, INTERVAL);
    }

    getLatestResult() {
        return { nodeStatistics: this._currentResults, diskSpace: this._diskSpace };
    }

    async _getEtcdData() {
        const taskExecutor = await DatabaseQuerier._getDiscoveryType('task-executor');
        const algorithms = await DatabaseQuerier._getAlgorithms();
        return { taskExecutor, algorithms };
    }

    buildResults(data) {
        const results = METRICS.map(metric => this.buildResultsForMetrics(metric, data));
        return results;
    }

    _buildAlgorithmResult(node, algorithms, metric, resourcePressure) {
        let otherAmount = 0;
        const algorithmsData = [];

        const getMetric = (mtr, algorithm) => {
            const rawMetric = algorithm[mtr] ? algorithm[mtr] : 0;
            if (mtr === 'mem') {
                return parse.getMemoryInMi(rawMetric);
            }
            return rawMetric;
        };
        node.workers.stats.forEach(algorithm => {
            const requestedAlgorithm = algorithms.find(alg => alg.name === algorithm.algorithmName);

            if (requestedAlgorithm) {
                algorithmsData.push({
                    name: algorithm.algorithmName,
                    amount: algorithm.count,
                    size: +(algorithm.count * getMetric(metric, requestedAlgorithm)).toFixed(1),
                });
            }
            else {
                otherAmount += algorithm.count;
            }
        });
        algorithmsData.push({
            name: 'other',
            amount: otherAmount,
            // size: +(node.total[metric] *  resourcePressure -(nodeFree + (algorithmsData.reduce((sum, alg) =>  sum + alg.size, 0)))).toFixed(1),
            size: +(node.other[metric].toFixed(1)),
        });
        const free = node.total[metric] * resourcePressure - node.requests[metric];
        algorithmsData.push({
            name: 'free',
            amount: -1,
            size: +(free < 0 ? 0 : free).toFixed(1),
        });
        algorithmsData.push({
            name: 'reserved',
            amount: otherAmount,
            size: +(node.total[metric] * (1 - resourcePressure) + (free < 0 ? free : 0)).toFixed(1),
        });
        algorithmsData.push({
            name: 'total',
            amount: -1,
            size: +node.total[metric].toFixed(1),
        });
        return algorithmsData;
    }

    buildResultsForMetrics(metric, { taskExecutor, algorithms }) {
        const legendAlgorithms = algorithms.map(alg => alg.name);
        const legend = [
            ...legendAlgorithms,
            'other',
            'free',
            'reserved'
        ];
        const results = taskExecutor.length ? taskExecutor[0].nodes.map(node => {
            const algorithmsData = this._buildAlgorithmResult(node, algorithms, metric, taskExecutor[0].resourcePressure[metric]);
            return {
                name: node.name,
                algorithmsData
            };
        }) : [];
        return { metric, results, legend };
    }

    async getDiskUsage() {
        let result;
        try {
            if (this._options.defaultStorage === 'fs') {
                const { baseDirectory } = this._options.fs;
                result = await checkDiskSpace(baseDirectory);
                const { size, free } = result;
                return { size, free };
            }
        }
        catch (e) {
            log.throttle.error(`Unable to get diskspace: ${e.message}`, { component }, e);
        }
        return result;
    }
}

module.exports = new NodesStatistics();
