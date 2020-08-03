const { stateType } = require('@hkube/consts');
const Logger = require('@hkube/logger');
const producer = require('../producer/producer');
const setting = require('./setting.json');
const stateAdapter = require('../states/stateAdapter');
const metrics = require('./metrics');
const discovery = require('./discovery');
const { Components } = require('../consts');
const component = Components.WORKER;
let log;

/**
 * TODO:
 * Add window of size 10
 * Handle Scale down
 * Add progress
 */

class AutoScaler {
    init(options) {
        this._options = options;
        log = Logger.GetLogFromContainer();
    }

    async start(jobData) {
        this._jobData = jobData;
        this._workload = Object.create(null);
        this._sentJobs = Object.create(null);
        await discovery.start({ jobId: jobData.jobId, taskId: jobData.taskId });
        this._pipeline = await stateAdapter.getExecution({ jobId: jobData.jobId });
        this._active = true;
        this._autoScaleInterval();
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
            const { nodeName, currentSize, queueSize, durations, sent, responses } = d;
            const requests = queueSize + sent;
            const node = this._pipeline.nodes.find(n => n.nodeName === nodeName && n.stateType === stateType.Stateless);
            if (node) {
                const workload = this._workload[nodeName] || this._createStatData(node);
                workload.requests.push(this._createItem(requests));
                workload.responses.push(this._createItem(responses));
                workload.queueSize.push(this._createItem(queueSize));
                const size = currentSize || discovery.countInstances(nodeName);
                this._workload[nodeName] = {
                    ...workload,
                    currentSize: size,
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
            requests: [],
            responses: [],
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
        }, this._options.autoScaler.interval);
    }

    autoScale() {
        const jobs = this._createScale(this._workload);
        this._createJobs(jobs);
        return jobs;
    }

    _createScale(workload) {
        const jobs = [];
        Object.values(workload).forEach((v) => {
            const { nodeName, algorithmName } = v;
            let replicas = 0;
            const currentSize = v.currentSize || 1;
            const response = [];

            setting.metrics.forEach((m) => {
                const metric = metrics[m.type];
                const ratio = metric(v, m);
                if (ratio >= m.minRatio) {
                    const sentJob = this._sentJobs[nodeName];
                    if (!sentJob || sentJob.replicas < currentSize) {
                        const scaleSize = Math.ceil(currentSize * ratio);
                        response.push({ metric: m.type, scaleSize });
                        replicas += Math.min(scaleSize, m.maxReplicas);
                    }
                    else if (sentJob && sentJob.replicas <= currentSize) {
                        delete this._sentJobs[nodeName];
                    }
                }
            });

            replicas = Math.min(replicas, setting.spec.max);
            if (replicas > 0) {
                const scaleLog = response.map(m => `${m.metric}:${m.scaleSize}`).join(',');
                log.info(`scaling for node ${nodeName} with metrics ${scaleLog}`, { component });
                jobs.push({ nodeName, algorithmName, replicas });
                this._sentJobs[nodeName] = { replicas };
            }
        });
        return jobs;
    }

    _createJobs(jobList) {
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
        });
    }
}

module.exports = new AutoScaler();
