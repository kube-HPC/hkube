const EventEmitter = require('events');
const validate = require('djsv');
const uuidv4 = require('uuid/v4');
const { Producer } = require('@hkube/producer-consumer');
const schema = require('lib/producer/schema');
const stateManager = require('lib/state/state-manager');
const Logger = require('@hkube/logger');
const log = Logger.GetLogFromContainer();
const components = require('common/consts/componentNames');

class JobProducer extends EventEmitter {

    constructor() {
        super();
        this._job = null;
        this._producer = null;
    }

    async init(options) {
        options = options || {};
        const setting = Object.assign({}, { redis: options.redis });
        const res = validate(schema.properties.setting, setting);
        if (!res.valid) {
            throw new Error(res.error);
        }
        this._producer = new Producer({ setting: setting });
        this._producer.on('job-waiting', (data) => {
            this.emit('task-waiting', data.jobID);
        }).on('job-active', (data) => {
            this.emit('task-active', data.jobID);
        });
    }

    async createJob(options) {
        const opt = {
            job: {
                id: options.taskId,
                type: options.type,
                data: options.data
            }
        }
        return await this._producer.createJob(opt);
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
