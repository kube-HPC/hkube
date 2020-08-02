const { stateType } = require('@hkube/consts');
const producer = require('../producer/producer');
const setting = require('./setting.json');
const stateAdapter = require('../states/stateAdapter');
const metrics = require('./metrics');
const discovery = require('./discovery');
const INTERVAL = 2000;

class AutoScaler {
    async start(jobData) {
        this._jobData = jobData;
        this._workload = Object.create(null);
        await discovery.start({ jobId: jobData.jobId, taskId: jobData.taskId });
        this._pipeline = await stateAdapter.getExecution({ jobId: jobData.jobId });
        this._active = true;
        // this._autoScaleInterval();
    }

    finish() {
        this._active = false;
        discovery.finish();
        clearInterval(this._interval);
        this._interval = null;
    }

    report(data) {
        if (!this._active) {
            return;
        }
        data.forEach((d) => {
            const { nodeName, queueSize, durations, sent, requests } = d;
            const node = this._pipeline.nodes.find(n => n.nodeName === nodeName && n.stateType === stateType.Stateless);
            if (node) {
                const workload = this._workload[nodeName] || this._createStatData(node);
                workload.sent.push(this._createItem(sent));
                workload.requests.push(this._createItem(requests));
                workload.queueSize.push(this._createItem(queueSize));
                const currentSize = discovery.countInstances(nodeName);
                this._workload[nodeName] = {
                    ...workload,
                    currentSize,
                    durations
                };
            }
        });
    }

    _createItem(count) {
        return { time: Date.now(), count: count || 0 };
    }

    _createStatData(node) {
        return {
            nodeName: node.nodeName,
            algorithmName: node.algorithmName,
            sent: [],
            requests: [],
            queueSize: []
        };
    }

    _autoScaleInterval() {
        if (this._interval) {
            return;
        }
        this._interval = setInterval(() => {
            if (this._activeInterval) {
                return;
            }
            try {
                this._activeInterval = true;
                this.autoScale();
            }
            catch { // eslint-disable-line
            }
            finally {
                this._activeInterval = false;
            }
        }, INTERVAL);
    }

    autoScale() {
        const jobs = [];
        Object.values(this._workload).forEach((v) => {
            const { nodeName, algorithmName } = v;
            let replicas = 0;
            const currentSize = v.currentSize || 1;

            setting.metrics.forEach((m) => {
                const metric = metrics[m.type];
                const ratio = metric(v, m);
                if (ratio >= m.minRatio) {
                    const scale = Math.ceil(currentSize * ratio);
                    replicas += Math.min(scale, m.maxReplicas);
                }
            });

            replicas = Math.min(replicas, setting.spec.max);
            if (replicas > 0) {
                jobs.push({ nodeName, algorithmName, replicas });
            }
        });
        return jobs;
    }

    createJobs(jobList) {
        const jobs = [];
        jobList.forEach((j) => {
            const { nodeName, algorithmName, replicas } = j;
            const input = [];
            const tasks = [];
            for (let i = 0; i < replicas; i += 1) {
                const taskId = producer.createTaskID();
                const task = { taskId, input, storage: {}, batchIndex: i + 1 };
                tasks.push(task);
            }
            const job = {
                ...this._jobData,
                nodeName,
                algorithmName,
                tasks
            };
            producer.createJob({ jobData: job });
            jobs.push(job);
        });
        return jobs;
    }
}

module.exports = new AutoScaler();
