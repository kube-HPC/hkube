const FixedWindow = require('./fixed-window');

class Statistics {
    constructor(options) {
        this._maxSize = options.maxSizeWindow;
        this._data = Object.create(null);
    }

    /**
     * The stats is a <Target, <Source, Stats>>
     * This class expose generator that implements custom iterator,
     * so it will be easy to iterate over this structure.
     * Example:
     * "D": {"A": Stats}
     *      {"B": Stats}
     *      {"C": Stats}}
     */
    report(data) {
        const { nodeName, source, currentSize } = data;
        let { queueSize, sent, responses, durations } = data;
        queueSize = queueSize || 0;
        sent = sent || 0;
        responses = responses || 0;
        durations = durations || [];
        const requests = queueSize + sent;
        this._data[nodeName] = this._data[nodeName] || {};
        const stats = this._data[nodeName][source] || this._createStatData({ maxSize: this._maxSize });
        stats.requests.add(this._createItem(requests));
        stats.responses.add(this._createItem(responses));
        stats.durations.addRange(durations);

        this._data[nodeName][source] = {
            ...stats,
            nodeName,
            currentSize
        };
    }

    *[Symbol.iterator]() {
        const values = Object.values(this._data);
        for (let i = 0; i < values.length; i += 1) {
            const entries = Object.entries(values[i]);
            for (let j = 0; j < entries.length; j += 1) {
                const [source, data] = entries[j];
                yield { source, data };
            }
        }
    }

    _createItem(count) {
        return { time: Date.now(), count };
    }

    _createStatData({ maxSize }) {
        return {
            requests: new FixedWindow(maxSize),
            responses: new FixedWindow(maxSize),
            durations: new FixedWindow(maxSize)
        };
    }
}

module.exports = Statistics;
