const STATES = {
    ACTIVE: 'active',
    FAILED: 'failed',
    COMPLETED: 'completed'
};

const PROGRESS = {
    [STATES.ACTIVE]: 20,
    [STATES.FAILED]: 80,
    [STATES.COMPLETED]: 100
};

module.exports = {
    STATES,
    PROGRESS
};
