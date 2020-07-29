const producer = require('../producer/producer');
const setting = require('./setting.json');
const stateAdapter = require('../states/stateAdapter');
const metrics = require('./metrics');
const discovery = require('./discovery');
const INTERVAL = 20000;

class AutoScaler {
    async start(jobData) {
        this._jobData = jobData;
        this._workload = Object.create(null);
        await discovery.start({ jobId: jobData.jobId, taskId: jobData.taskId });
        this._pipeline = await stateAdapter.getExecution({ jobId: jobData.jobId });
        this._checkBackPressureInterval();
    }

    finish() {
        discovery.finish();
        clearInterval(this._interval);
        this._interval = null;
    }

    report(data) {
        if (!this._pipeline) {
            return;
        }
        data.forEach((d) => {
            const { nodeName, queueSize, durations, sent } = d;
            const node = this._pipeline.nodes.find(n => n.nodeName === nodeName); // && n.stateType === 'stateless');
            if (node) {
                const workload = this._workload[nodeName] || { algorithmName: node.algorithmName, nodeName, sentList: [] };
                workload.sentList.push({ time: Date.now(), count: sent });
                const currentSize = discovery.countInstances(nodeName);
                this._workload[nodeName] = {
                    ...workload,
                    currentSize,
                    queueSize,
                    durations
                };
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
            catch { // eslint-disable-line
            }
            finally {
                this._active = false;
            }
        }, INTERVAL);
    }

    _checkBackPressure(jobData) {
        Object.entries(this._workload).forEach(([, v]) => {
            const { nodeName, algorithmName, queueSize } = v;
            if (queueSize === 0) {
                return;
            }
            let replicas = 0;
            setting.metrics.forEach((m) => {
                const metric = metrics[m.type];
                const ratio = metric(v, m);
                if (ratio >= m.percent) {
                    replicas += Math.ceil(setting.spec.min * ratio);
                }
            });

            replicas = Math.min(replicas, setting.spec.max);

            // const discovery = {};
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
