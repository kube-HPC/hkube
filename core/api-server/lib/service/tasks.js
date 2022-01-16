const stateManager = require('../state/state-manager');
const validator = require('../validation/api-validator');

class TasksService {
    async search(options) {
        validator.executions.validateSearch(options);
        return stateManager.searchTasks(options);
    }
}

module.exports = new TasksService();
