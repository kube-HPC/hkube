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
        const { queueSize = 0, sent = 0, responses = 0, dropped = 0, durations = [], netDurations = [], queueDurations = [] } = data;
        const requests = queueSize + sent;
        const stats = this._data[source] || this._createStatData({ maxSize: this._maxSize });
        stats.queueSize = queueSize;
        stats.dropped = dropped;
        stats.requests.add(this._createItem(requests));
        stats.responses.add(this._createItem(responses));
        stats.durations.addRange(netDurations);
        stats.grossDurations.addRange(durations); // used to calculate round trip
        stats.queueDurations.addRange(queueDurations);

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
            requests: new FixedWindow(maxSize), // Brings one value every 2 seconds, meaning for a window_size of 10 we will consider reports of last 20 seconds.
            responses: new FixedWindow(maxSize),
            durations: new FixedWindow(maxSize * 10), // Brings window_size values every 2 seconds, so for a window_size multiplied by 10 we will consider values that occured in the last 20 seconds.
            grossDurations: new FixedWindow(maxSize * 10),
            queueDurations: new FixedWindow(maxSize * 10),
        };
    }
}

module.exports = Statistics;
