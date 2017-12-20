const uuidv4 = require('uuid/v4');
const Task = require('lib/tasks/Task');

class TaskFactory {

    constructor() {
        this._job = null;
        this._pipeline = null;
        this._nodes = null;
    }

    create(node) {
        const taskId = this._createTaskID(node);
        const task = new Task({
            taskId: taskId,
            nodeName: node.name,
            algorithm: node.algorithm,
            batchID: node.batchID,
            input: node.input
        });
        return task;
    }

    _createTaskID(node) {
        return [node.name, node.algorithm, uuidv4()].join(':');
    }
}

module.exports = new TaskFactory();
