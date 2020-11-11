const EventEmitter = require('events');
const { Producer } = require('@hkube/producer-consumer');
const { tracer } = require('@hkube/metrics');

class JobProducer extends EventEmitter {
    constructor() {
        super();
        this._producer = null;
    }

    async init(option) {
        const options = option || {};
        this._producer = new Producer({
            setting: {
                tracer,
                redis: options.redis,
                ...options.jobs.producer
            }
        });
    }

    async createJob({ jobId, pipeline, options, batch }) {
        let tasks = [];
        if (batch) {
            tasks = batch.map(b => ({ taskId: b.taskId, status: b.status, input: b.input, batchIndex: b.batchIndex, storage: b.storage }));
        }
        else {
            tasks.push({ taskId: options.node.taskId, status: options.node.status, input: options.node.input, storage: options.storage });
        }
        const jobOptions = {
            type: options.node.algorithmName,
            data: {
                jobId,
                tasks,
                nodeName: options.node.nodeName,
                metrics: options.node.metrics,
                ttl: options.node.ttl,
                retry: options.node.retry,
                pipelineName: pipeline.name,
                stateType: options.node.stateType,
                priority: pipeline.priority,
                kind: pipeline.kind,
                algorithmName: options.node.algorithmName,
                parents: options.parents,
                childs: options.childs,
                isCustomFlow: options.node.isCustomFlow,
                parsedFlow: pipeline.streaming?.parsedFlow,
                info: {
                    extraData: options.node.extraData,
                    savePaths: options.paths,
                    lastRunResult: pipeline.lastRunResult,
                    rootJobId: pipeline.rootJobId
                }
            }
        };
        await this._createJob(jobOptions);
    }

    async _createJob(options) {
        const opt = {
            job: {
                type: options.type,
                data: options.data
            }
        };
        if (options.data && options.data.jobId) {
            const topSpan = tracer.topSpan(options.data.jobId);
            if (topSpan) {
                opt.tracing = {
                    parent: topSpan.context(),
                    tags: {
                        jobId: options.data.jobId
                    }
                };
            }
        }
        await this._producer.createJob(opt);
    }
}

module.exports = new JobProducer();
