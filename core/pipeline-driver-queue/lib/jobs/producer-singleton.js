const { Producer } = require('@hkube/producer-consumer');
const { tracer } = require('@hkube/metrics');

class ProducerSingleton {
    constructor() {
        this.options = null;
    }
    async init(options) {
        this.options = options;
        this.producer = new Producer({ setting: { redis: options.redis, prefix: 'jobs-workers', tracer} });
    }
    get get() {
        return this.producer;
    }
}


module.exports = new ProducerSingleton();
