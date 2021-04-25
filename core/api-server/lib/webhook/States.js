const { pipelineStatuses } = require('@hkube/consts');
const States = {
    PENDING: 'pending',
    COMPLETED: 'completed',
    SUCCEED: 'succeed',
    FAILED: 'failed'
};

const Types = {
    PROGRESS: 'progress',
    RESULT: 'result'
};

const CompletedState = [pipelineStatuses.COMPLETED, pipelineStatuses.FAILED, pipelineStatuses.STOPPED];
const isCompletedState = (state) => {
    return CompletedState.includes(state);
};

module.exports = {
    States,
    Types,
    isCompletedState
};
