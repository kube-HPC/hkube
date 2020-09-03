/**
 * Just a simple map helper <nodeName, throughput>
 */
class Throughput {
    constructor() {
        this._data = Object.create(null);
    }

    update(nodeName, data) {
        this._data[nodeName] = data;
    }

    get data() {
        return this._data;
    }
}

module.exports = Throughput;
