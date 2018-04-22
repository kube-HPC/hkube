const { Producer } = require('@hkube/producer-consumer');
class ProducerSingleton {
    constructor() {
        this.options = null;
    }
    async init(options) {
        this.options = options;
        this.producer = new Producer({ setting: { redis: options.redis, prefix: 'jobs-workers' } });
    }
    get get() {
        return this.producer;
    }
}


module.exports = new ProducerSingleton();
