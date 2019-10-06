const startSubPipeline = {
    type: 'object',
    properties: {
        subPipelineId: {
            type: 'string'
        },
        subPipeline: {
            type: 'object'
        }
    },
    required: [
        'subPipelineId',
        'subPipeline'
    ]
};

const stopSubPipeline = {
    type: 'object',
    properties: {
        subPipelineId: {
            type: 'string'
        }
    },
    required: [
        'subPipelineId'
    ]
};

module.exports = {
    startSubPipeline,
    stopSubPipeline
};
