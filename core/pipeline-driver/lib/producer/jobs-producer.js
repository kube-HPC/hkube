const EventEmitter = require('events');
const validate = require('djsv');
const uuidv4 = require('uuid/v4');
const { Producer } = require('@hkube/producer-consumer');
const schema = require('./schema');
const Events = require('../consts/Events');
const States = require('../state/States');
const stateManager = require('../state/state-manager');
const log = require('@hkube/logger').GetLogFromContainer();
const components = require('../../common/consts/componentNames');
const { tracer } = require('@hkube/metrics');

class JobProducer extends EventEmitter {

    constructor() {
        super();
        this._job = null;
        this._producer = null;
        this._stalledJobs = new Map();
    }

    async init(options) {
        options = options || {};
        const setting = Object.assign({}, { redis: options.redis });
        const res = validate(schema.properties.setting, setting);
        if (!res.valid) {
            throw new Error(res.error);
        }
        setting.tracer = tracer;
        this._producer = new Producer({ setting: setting });
        this._producer.on(Events.JOBS.WAITING, (data) => {
            this.emit(Events.TASKS.WAITING, data.jobID);
        }).on(Events.JOBS.ACTIVE, (data) => {
            this.emit(Events.TASKS.ACTIVE, data.jobID);
        }).on(Events.JOBS.STALLED, (data) => {
            let stalled = this._stalledJobs.get(data.jobID) || 0;
            stalled++;
            if (stalled === 1) {
                stateManager.emit(Events.TASKS.FAILED, { taskId: data.jobID, status: States.FAILED, error: 'CrashLoopBackOff' });
            }
            this._stalledJobs.set(data.jobID, stalled);
        });
    }

    async getWorkers(options) {
        return this._producer.getWorkers(options);
    }

    async createJob(options) {
        const opt = {
            job: {
                id: options.data && options.data.taskID,
                type: options.type,
                data: options.data,
            }
        }
        if (options.data && options.data.jobID) {
            const topSpan = tracer.topSpan(options.data.jobID);
            if (topSpan) {
                opt.tracing = {
                    parent: topSpan.context(),
                    tags: {
                        taskID: opt.job.taskID
                    }
                }
            }
        }
        return this._producer.createJob(opt);
    }

    async stopJob(options) {
        let result = null;
        try {
            result = await this._producer.stopJob({ type: options.type, jobID: options.jobID });
        }
        catch (error) {
            log.error(error.message, { component: components.JOBS_PRODUCER });
        }
        return result;
    }
}

module.exports = new JobProducer();
