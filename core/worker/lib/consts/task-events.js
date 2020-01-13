const { taskStatuses } = require('@hkube/consts');

const events = {
    ACTIVE: `task-${taskStatuses.ACTIVE}`,
    SUCCEED: `task-${taskStatuses.SUCCEED}`,
    FAILED: `task-${taskStatuses.FAILED}`,
    STALLED: `task-${taskStatuses.STALLED}`,
    CRASHED: `task-${taskStatuses.CRASHED}`
};

module.exports = events;
