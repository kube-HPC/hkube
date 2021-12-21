const config = {};
config.queue = {
    updateInterval: 60000,
    maxPersistencySize: process.env.MAX_PERSISTENCY_SIZE || '1e6'
};
config.queueId = process.env.QUEUE_ID || 'queue-55491-abc-133';
config.producerUpdateInterval = 60000;
config.db = {
    mongo: {
        dbName: process.env.MONGODB_DB_NAME || 'tests',
    }
};
module.exports = config;
