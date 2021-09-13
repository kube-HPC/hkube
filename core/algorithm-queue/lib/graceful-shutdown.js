const log = require('@hkube/logger').GetLogFromContainer();
const queuesManager = require('./queues-manager');
const component = require('./consts/component-name').GRACEFUL_SHUTDOWN;

class GracefulShutdown {
    async shutdown(cb) {
        try {
            log.info('starting graceful shutdown', { component });
            await queuesManager.shutdown();
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
