const { Producer } = require('@hkube/producer-consumer');
const { tracer } = require('@hkube/metrics');

class ProducerSingleton {
    constructor() {
        this.options = null;
    }

    async init(options) {
        this.options = options;
        this.producer = new Producer({
            setting: {
                redis: options.redis,
                tracer,
                ...options.producer
            }
        });
        this.queue = this.producer._createQueue(options.algorithmType);
    }

    get get() {
        return this.producer;
    }
}

module.exports = new ProducerSingleton();
