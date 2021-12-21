const config = {};
config.db = {
    mongo: {
        dbName: process.env.MONGODB_DB_NAME || 'tests',
    }
};
module.exports = config;
