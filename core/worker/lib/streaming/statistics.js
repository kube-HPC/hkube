const discovery = require('./service-discovery');
const FixedWindow = require('./fixed-window');

class Statistics {
    constructor(maxSize) {
        this._maxSize = maxSize;
        this._workload = Object.create(null);
    }

    report(data) {
        const { nodeName, currentSize } = data;
        let { queueSize, sent, responses } = data;
        queueSize = queueSize || 0;
        sent = sent || 0;
        responses = responses || 0;
        const requests = queueSize + sent;
        const workload = this._workload[nodeName] || this._createStatData({ nodeName, maxSize: this._maxSize });
        workload.requests.add(this._createItem(requests));
        workload.responses.add(this._createItem(responses));
        const size = currentSize || discovery.countInstances(nodeName);
        this._workload[nodeName] = {
            ...workload,
            currentSize: size
        };
    }

    get data() {
        return this._workload;
    }

    _createItem(count) {
        return { time: Date.now(), count: count || 0 };
    }

    _createStatData({ nodeName, maxSize }) {
        return {
            nodeName,
            requests: new FixedWindow(maxSize),
            responses: new FixedWindow(maxSize)
        };
    }
}

module.exports = Statistics;
