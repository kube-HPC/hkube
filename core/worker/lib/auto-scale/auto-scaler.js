const producer = require('../producer/producer');
const setting = require('./setting.json');
const stateAdapter = require('../states/stateAdapter');
const metrics = require('./metrics');
const INTERVAL = 2000;

class AutoScaler {
    async init(jobData) {
        this._jobData = jobData;
        this._workload = Object.create(null);
        this._instances = Object.create(null);
        if (jobData.kind === 'stream') {
            this._pipeline = await stateAdapter.getExecution({ jobId: jobData.jobId });
            this._checkBackPressureInterval();
        }
    }

    finish() {
        clearInterval(this._interval);
        this._interval = null;
    }

    report(data) {
        if (!this._pipeline) {
            return;
        }
        data.forEach((d) => {
            const { nodeName, currentSize, queueSize, duration } = d;
            const node = this._pipeline.nodes.find(n => n.nodeName === nodeName && n.stateType === 'stateless');
            if (node) {
                this._workload[nodeName] = { algorithmName: node.algorithmName, nodeName, currentSize, queueSize, duration };
            }
        });
    }

    _checkBackPressureInterval() {
        if (this._interval) {
            return;
        }
        this._interval = setInterval(() => {
            if (this._active) {
                return;
            }
            try {
                this._active = true;
                this._checkBackPressure(this._jobData);
            }
            catch (error) {
            }
            finally {
                this._active = false;
            }
        }, INTERVAL);
    }

    _checkBackPressure(jobData) {

        Object.entries(this._workload).forEach(([, v]) => {
            const { nodeName, algorithmName, currentSize, queueSize } = v;
            if (queueSize === 0) {
                return;
            }
            let replicas = 0;
            setting.metrics.forEach((m) => {
                const metric = metrics[m.type];
                const ratio = metric(v, m);
                if (ratio >= m.percent) {
                    replicas += Math.ceil(queueSize * ratio);
                }
            });

            replicas = Math.min(replicas, setting.spec.max);

            const discovery = {};
            const input = [];
            const tasks = [];

            let i = 0;
            while (i < replicas) {
                i += 1;
                const taskId = producer.createTaskID();
                const task = { taskId, input, storage: {}, batchIndex: i };
                tasks.push(task);
            }
            const job = {
                ...jobData,
                nodeName,
                algorithmName,
                tasks
            };
            producer.createJob({ jobData: job });
        });
    }
}

module.exports = new AutoScaler();
