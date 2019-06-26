const groupTypes = {
    STATUS: {
        NOT_STARTED: 'notStarted',
        RUNNING: 'running',
        COMPLETED: 'completed',
    },
    BATCH: {
        NOT_STARTED: 'batchNotStarted',
        RUNNING: 'batchRunning',
        COMPLETED: 'batchCompleted',
        ERRORS: 'batchErrors',
    },
    SINGLE: {
        NOT_STARTED: 'notStarted',
        RUNNING: 'running',
        COMPLETED: 'completed',
    },
    EDGE: {
        WAIT_ANY: 'waitAny',
        ALGORITHM_EXECUTION: 'algorithmExecution',
        NONE: 'none'
    }
};


module.exports = {
    groupTypes
};
