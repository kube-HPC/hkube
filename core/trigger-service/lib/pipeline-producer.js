

class PipelineProducer {
    constructor() {
        this.config = null;
    }
    async init(config) {
        this.config = config;
    }
    async produce(pipeline) {
        return true;
    }
}


module.exports = new PipelineProducer();
