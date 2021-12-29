const log = require('@hkube/logger').GetLogFromContainer();
const queueRunner = require('./queue-runner');
const consumer = require('./jobs/consumer');
const component = require('./consts/component-name').GRACEFUL_SHUTDOWN;

class GracefulShutdown {
    async shutdown(cb) {
        try {
            log.info('starting graceful shutdown', { component });

            // pause consumer from consuming more jobs
            await consumer.pause();

            // in case of redis connection issue, the persistency will wait forever
            const timeout = new Promise((resolve) => setTimeout(resolve, 10000));
            await Promise.race([queueRunner.shutdown(), timeout]);

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
