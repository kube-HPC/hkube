const FixedWindow = require('./fixed-window');

/**
 * This class holds statistics in a structure of <Source, Stats>
 * For instance, nodes A,C stream data to node D.
 * so the structure will look like:
 * "A-<uid>": <Stats> (slave)
 * "A-<uid>": <Stats> (master)
 * "C-<uid>": <Stats> (slave)
 *
 */
class Statistics {
    constructor(options, onSourceRemove) {
        this._maxSize = options.statistics.maxSizeWindow;
        this._minTimeNonStatsReport = options.statistics.minTimeNonStatsReport;
        this._onSourceRemove = onSourceRemove;
        this._data = Object.create(null);
    }

    report(data) {
        const { source, currentSize } = data;
        const { queueSize = 0, sent = 0, responses = 0, dropped = 0, durations = [], netDurations = [] } = data;
        const requests = queueSize + sent;
        const stats = this._data[source] || this._createStatData({ maxSize: this._maxSize });
        stats.queueSize = queueSize;
        stats.dropped = dropped;
        stats.requests.add(this._createItem(requests));
        stats.responses.add(this._createItem(responses));
        stats.durations.addRange(netDurations);
        stats.grossDurations.addRange(durations);

        this._data[source] = {
            ...stats,
            size: stats.requests.items.length,
            time: Date.now(),
            currentSize
        };
    }

    get() {
        const stats = [];
        Object.entries(this._data).forEach(([k, v]) => {
            if (Date.now() - v.time > this._minTimeNonStatsReport) {
                delete this._data[k];
                this._onSourceRemove({ source: k });
            }
            else {
                stats.push({ source: k, data: v });
            }
        });
        return stats;
    }

    _createItem(count) {
        return { time: Date.now(), count };
    }

    _createStatData({ maxSize }) {
        return {
            requests: new FixedWindow(maxSize),
            responses: new FixedWindow(maxSize),
            durations: new FixedWindow(maxSize),
            grossDurations: new FixedWindow(maxSize),
        };
    }
}

module.exports = Statistics;
