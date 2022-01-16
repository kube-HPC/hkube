const EventEmitter = require('events');
const dbConnect = require('@hkube/db');
const Logger = require('@hkube/logger');
const { taskStatuses } = require('@hkube/consts');
const component = require('../consts/component-name').DB;

class DBConnection extends EventEmitter {
    async init(options) {
        const log = Logger.GetLogFromContainer();
        const { provider, ...config } = options.db;
        this._db = dbConnect(config, provider);
        await this._db.init();
        this._watchJobStatus();
        log.info(`initialized mongo with options: ${JSON.stringify(this._db.config)}`, { component });
    }

    async _watchJobStatus() {
        await this._db.jobs.watchStatus({}, (job) => {
            this.emit('job-change', job);
        });
    }

    async getJobStatus({ jobId }) {
        return this._db.jobs.fetchStatus({ jobId });
    }

    getTask({ jobId, taskId }) {
        return this._db.tasks.fetch({ jobId, taskId });
    }

    async getTasksById({ id, jobId }) {
        return this._db.tasks.search({ id, jobId });
    }

    async getTasks({ algorithmName }) {
        return this._db.tasks.search({ algorithmName, status: taskStatuses.QUEUED });
    }

    async updateTasks({ id, status }) {
        return this._db.tasks.updateTasksStatus({ id, status });
    }

    async updateTask({ jobId, taskId, status, error, retries }) {
        return this._db.tasks.update({ jobId, taskId, status, error, retries });
    }
}

module.exports = new DBConnection();
