const Validator = require('ajv');
const Logger = require('@hkube/logger');
const { tracer } = require('@hkube/metrics');
const { uid } = require('@hkube/uid');
const { Producer, Events } = require('@hkube/producer-consumer');
const { schema } = require('./schema');
const { Components } = require('../consts');
const component = Components.JOBS_PRODUCER;
const validator = new Validator({ useDefaults: true, coerceTypes: false });
let log;

class Producers {
    init(options) {
        log = Logger.GetLogFromContainer();
        this._schema = validator.compile(schema);
        const setting = {
            redis: options.redis,
            tracer,
            enableCheckStalledJobs: false
        };
        const valid = this._schema(setting);
        if (!valid) {
            throw new Error(validator.errorsText(this._schema.errors));
        }
        this._producer = new Producer({ setting });
        this._producer.on(Events.WAITING, (data) => {
            const jobId = data?.options?.data?.jobId;
            const taskId = data?.options?.data?.tasks[0]?.taskId;
            log.info(`${Events.WAITING} ${jobId} ${taskId}`, { component, jobId, taskId, status: Events.WAITING });
        });
        this._producer.on(Events.ACTIVE, async (data) => {
            const jobId = data?.options?.data?.jobId;
            const taskId = data?.options?.data?.tasks[0]?.taskId;
            log.info(`${Events.ACTIVE} ${jobId} ${taskId}`, { component, jobId, taskId, status: Events.ACTIVE });
        });
        this._producer.on(Events.COMPLETED, (data) => {
            const jobId = data?.options?.data?.jobId;
            const taskId = data?.options?.data?.tasks[0]?.taskId;
            log.info(`${Events.COMPLETED} ${jobId} ${taskId}`, { component, jobId, taskId, status: Events.COMPLETED });
        });
        this._producer.on(Events.FAILED, (data) => {
            const jobId = data?.options?.data?.jobId;
            const taskId = data?.options?.data?.tasks[0]?.taskId;
            log.info(`${Events.FAILED} ${jobId} ${taskId} error: ${data?.error}`, { component, jobId, taskId, status: Events.FAILED });
            // workaround for __default__ handler being called
            if (data?.error === Events.DEFAULT_HANDLER_CALLED && this._executions.get(taskId)) {
                log.error('Crashing process because of error');
                process.exit(1);
            }
        });
    }

    createJob({ jobData, tracing }) {
        const job = this._createJobData(jobData);
        return this._producer.createJob({ job, tracing });
    }

    _createJobData(options) {
        const jobOptions = {
            type: options.algorithmName,
            data: {
                jobId: options.jobId,
                tasks: options.tasks,
                nodeName: options.nodeName,
                algorithmName: options.algorithmName,
                parentNodeName: options.parentNodeName,
                pipelineName: options.pipelineName,
                priority: options.priority,
                metrics: options.metrics,
                ttl: options.ttl,
                retry: options.retry,
                stateType: options.stateType,
                kind: options.kind,
                parents: options.parents,
                childs: options.childs,
                info: options.info,
                isScaled: options.isScaled,
                parsedFlow: options.parsedFlow,
                defaultFlow: options.defaultFlow,
            }
        };
        return jobOptions;
    }

    createTaskID() {
        return uid({ length: 8 });
    }
}

module.exports = new Producers();
