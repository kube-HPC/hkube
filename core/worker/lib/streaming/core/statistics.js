const discovery = require('../services/service-discovery');
const FixedWindow = require('./fixed-window');

class Statistics {
    constructor(options) {
        this._maxSize = options.maxSizeWindow;
        this._data = Object.create(null);
    }

    report(data) {
        const { source, target, currentSize: size } = data;
        let { queueSize, sent, responses, durations } = data;
        queueSize = queueSize || 0;
        sent = sent || 0;
        responses = responses || 0;
        durations = durations || [];
        const requests = queueSize + sent;
        this._data[target] = this._data[target] || {};
        const stats = this._data[target][source] || this._createStatData({ maxSize: this._maxSize });
        stats.requests.add(this._createItem(requests));
        stats.responses.add(this._createItem(responses));
        stats.durations.addRange(durations);
        const currentSize = size || discovery.countInstances(target);

        this._data[target][source] = {
            ...stats,
            nodeName: target,
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
