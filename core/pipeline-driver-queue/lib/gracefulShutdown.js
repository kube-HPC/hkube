const consumer = require('./jobs/consumer');
const producer = require('./jobs/producer');
const persistence = require('./persistency/persistence');
const queueRunner = require('./queue-runner');

class GracefulShutdown {
    async shutdown() {
        await consumer.shutdown();
        await producer.shutdown();
        const queue = queueRunner.queue?.getQueue();
        await persistence.store({ data: queue });
    }
}

module.exports = new GracefulShutdown();
