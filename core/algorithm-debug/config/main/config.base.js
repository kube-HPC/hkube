const packageJson = require(process.cwd() + '/package.json');

const config = {};
config.serviceName = packageJson.name;
config.version = packageJson.version;
module.exports = config;
config.communication = {
    port: process.env.WORKER_CLIENT_SOCKET_PORT || 3005
};
