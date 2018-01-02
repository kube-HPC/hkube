const Queue = require('./queue');
class QueueRunner {
    constructor() {
         
    }
    init(config) {
        this.config = config;
        this.queue = new Queue({updateInterval: this.config.queue.updateInterval});        
    }
}

module.exports = new QueueRunner();
