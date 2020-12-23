const packageJson = require(process.cwd() + '/package.json');
const formatter = require(process.cwd() + '/lib/utils/formatters');

const config = {};
config.serviceName = packageJson.name;
config.version = packageJson.version;

config.rest = {
    port: process.env.CACHING_SERVICE || 9005,
    prefix: '/',
    poweredBy: 'HKube Server',
    rateLimit: {
        route: '/',
        ms: process.env.API_SERVER_RATE_LIMIT_MS || 1000,
        max: process.env.API_SERVER_RATE_LIMIT_MAX || 5,
        delay: process.env.API_SERVER_RATE_LIMIT_DELAY || 0
    }
};

config.db = {
    provider: 'mongo',
    mongo: {
        auth: {
            user: process.env.MONGODB_SERVICE_USER_NAME || 'tester',
            password: process.env.MONGODB_SERVICE_PASSWORD || 'password',
        },
        host: process.env.MONGODB_SERVICE_HOST || 'localhost',
        port: formatter.parseInt(process.env.MONGODB_SERVICE_PORT, 27017),
        dbName: process.env.MONGODB_DB_NAME || 'hkube',
    }
};

module.exports = config;
