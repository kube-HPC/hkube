
var packageJson = require(process.cwd() + '/package.json');
var config = module.exports = {};

config.serviceName = packageJson.name;

config.adapter = process.env.WORKER_ALGORITHM_PROTOCOL || 'socket';

config.algorithm = {
    codePath: process.env.ALGORITHM_CODE_PATH
};

config.socket = {
    port: process.env.WORKER_SOCKET_PORT || 3000,
    host: process.env.WORKER_SOCKET_HOST || 'localhost',
    protocol: process.env.WORKER_SOCKET_PROTOCOL || 'ws'
};



