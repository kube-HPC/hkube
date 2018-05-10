const { parse } = require('url');
const prometheus = require('../data/prometheus.1.json');

class Client {

    init(options) {
        return;
    }

    async query(opts) {
        return;
    }

    async range(opts) {
        return prometheus;
    }
}

module.exports = new Client();
