const log = require('@hkube/logger').GetLogFromContainer();
const consumer = require('./jobs/consumer');
const producer = require('./jobs/producer');
const queueRunner = require('./queue-runner');
const component = require('./consts/component-name').GRACEFUL_SHUTDOWN;

class GracefulShutdown {
    async shutdown(cb) {
        try {
            log.info('starting graceful shutdown', { component });
            await consumer.shutdown();
            await producer.shutdown();
            for (const queue of [queueRunner.queue, queueRunner.preferredQueue]) {
                if (queue) {
                    await queue.persistenceStore();
                }
            }
            log.info('finish graceful shutdown', { component });
        }
        catch (e) {
            log.error(`error in graceful shutdown ${e.message}`, { component }, e);
        }
        finally {
            cb();
        }
    }
}

module.exports = new GracefulShutdown();
