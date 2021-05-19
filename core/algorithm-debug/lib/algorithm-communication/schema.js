const config = require('../../config/main/config.base');

const socketWorkerCommunicationSchema = {
    type: 'object',
    properties: {
        host: {
            type: 'string',
            default: 'localhost'
        },
        port: {
            type: ['integer', 'string'],
            default: config.communication.port
        },
        protocol: {
            type: 'string',
            default: 'ws'
        },
        pingTimeout: {
            type: 'integer',
            default: 30000
        },
        maxPayload: {
            type: 'integer',
            default: 1e8
        }
    }
};

module.exports = {
    socketWorkerCommunicationSchema
};
