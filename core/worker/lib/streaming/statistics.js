const discovery = require('./service-discovery');
const FixedWindow = require('./fixed-window');

class Statistics {
    constructor(maxSize) {
        this._maxSize = maxSize;
        this._data = Object.create(null);
    }

    report(data) {
        const { nodeName, currentSize: size } = data;
        let { queueSize, sent, responses, durations } = data;
        queueSize = queueSize || 0;
        sent = sent || 0;
        responses = responses || 0;
        durations = durations || [];
        const requests = queueSize + sent;
        const stats = this._data[nodeName] || this._createStatData({ maxSize: this._maxSize });
        stats.requests.add(this._createItem(requests));
        stats.responses.add(this._createItem(responses));
        stats.durations.addRange(durations);
        const currentSize = size || discovery.countInstances(nodeName);

        this._data[nodeName] = {
            ...stats,
            nodeName,
            currentSize
        };
    }

    get data() {
        return this._data;
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
