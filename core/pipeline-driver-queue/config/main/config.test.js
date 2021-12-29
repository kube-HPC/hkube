const config = {};
config.checkConcurrencyQueueInterval = process.env.CHECK_CONCURRENCY_QUEUE_INTERVAL || 50000;
module.exports = config;
