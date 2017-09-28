var config = module.exports = {};

config.videoService = {
    rest: {
        protocol: process.env.SUPERVISOR_SERVICE_SECURED ? 'https' : 'http',
        host: process.env.SUPERVISOR_SERVICE_HOST || 'localhost',
        port: process.env.SUPERVISOR_SERVICE_PORT || 9090,
        path: '/video/play'
    },
    socket: {
        protocol: null,
        host: null,
        port: null,
        path: '/supervisor'
    }
};