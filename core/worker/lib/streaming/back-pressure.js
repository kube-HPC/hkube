const Logger = require('@hkube/logger');
const INTERVAL = 2000;

class BackPressure {
    init() {
        this._algorithms = Object.create(null);
    }

    finish() {
        clearInterval(this._interval);
        this._interval = null;
    }

    report(data) {
        data.forEach((d) => {
            const { algorithm, queueSize } = d;
            const algorithmObj = this._algorithms[algorithm] || { queueSize };

            const diff = queueSize - algorithmObj.queueSize;
            this._algorithms[algorithm] = { queueSize };

            if (diff > 0) {
            }

        });
    }

    _checkBackPressure() {
        if (this._interval) {
            return;
        }
        this._interval = setInterval(() => {
            if (this._active) {
                return;
            }
            try {
                this._active = true;
                Object.entries(this._algorithms).forEach(([k, v]) => {
                    const { jobData } = jobConsumer;
                    const taskId = this._createTaskID();
                    const task = { taskId, input: newInput, storage };
                    const job = this._createJobData({ algorithmName, task, jobData });
                });
            }
            catch (error) {

            }
            finally {
                this._active = false;
            }

        }, INTERVAL);
    }

    createJobData({ algorithmName, tasks, jobData }) {
        const jobOptions = {
            type: algorithmName,
            data: {
                tasks,
                jobId: jobData.jobId,
                algorithmName,
                pipelineName: jobData.pipelineName,
                priority: jobData.priority,
                info: {
                    ...jobData.info,
                    extraData: undefined
                }
            }
        };
        return jobOptions;
    }
}

module.exports = new BackPressure();
