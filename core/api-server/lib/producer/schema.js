module.exports = {
    name: 'options',
    type: 'object',
    properties: {
        setting: {
            type: 'object',
            properties: {
                prefix: {
                    type: 'string',
                    default: 'pipeline-driver-queue',
                    description: 'prefix for all queue keys'
                }
            }
        }
    }
};
