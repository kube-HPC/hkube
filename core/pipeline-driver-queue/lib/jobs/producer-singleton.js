const { Producer } = require('@hkube/producer-consumer');
const { tracer } = require('@hkube/metrics');

class ProducerSingleton {
    constructor() {
        this.options = null;
    }

    async init(options) {
        this.options = options;
        this._producer = new Producer({ setting: { redis: options.redis, prefix: 'jobs-pipeline', tracer } });
    }

    get get() {
        return this._producer;
    }
}

module.exports = new ProducerSingleton();
