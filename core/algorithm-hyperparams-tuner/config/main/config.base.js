const packageJson = require(process.cwd() + '/package.json');

const config = {};
config.serviceName = packageJson.name;
config.version = packageJson.version;
module.exports = config;
