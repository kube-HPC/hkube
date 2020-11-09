const startAlgorithmSchema = {
    type: 'object',
    properties: {
        execId: {
            type: 'string',
            minLength: 1
        },
        algorithmName: {
            type: 'string',
            minLength: 1
        },
        input: {
            type: 'array'
        }
    },
    required: [
        'execId',
        'algorithmName'
    ]
};

const stopAlgorithmSchema = {
    type: 'object',
    properties: {
        execId: {
            type: 'string',
            minLength: 1
        },
        reason: {
            type: 'string'
        }
    },
    required: [
        'execId'
    ]
};

module.exports = {
    startAlgorithmSchema,
    stopAlgorithmSchema,
};
