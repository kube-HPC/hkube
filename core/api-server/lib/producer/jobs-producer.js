const EventEmitter = require('events');
const validate = require('djsv');
const { Producer } = require('producer-consumer.rf');
const schema = require('lib/producer/schema');
const Logger = require('logger.rf');
const log = Logger.GetLogFromContainer();
const components = require('common/consts/componentNames');

class JobProducer extends EventEmitter {

    constructor() {
        super();
    }

    init(options) {
        const setting = Object.assign({}, { redis: options.redis });
        const res = validate(schema.properties.setting, setting);
        if (!res.valid) {
            throw new Error(res.errors[0].stack);
        }

        this._producer = new Producer({ setting: setting });
        this._producer.on('job-waiting', (data) => {
            log.info(`job waiting ${data.jobID}`, { component: components.JOBS_PRODUCER });
        }).on('job-active', (data) => {
            log.info(`job active ${data.jobID}`, { component: components.JOBS_PRODUCER });
        }).on('job-completed', (data) => {
            log.info(`job completed ${data.jobID}`, { component: components.JOBS_PRODUCER });
        }).on('job-failed', (data) => {
            log.error(`job failed ${data.jobID}, error: ${data.error}`, { component: components.JOBS_PRODUCER });
        });
    }

    createJobID(pipeline) {
        return this._producer.createJobID(pipeline.name);
    }

    async createJob(options) {
        const opt = {
            job: {
                id: options.jobId,
                type: 'pipeline-driver-job',
                data: options.pipeline
            }
        }
        return await this._producer.createJob(opt);
    }

    async stopJob(options) {
        return await this._producer.stopJob({ type: 'pipeline-driver-job', jobID: options.jobId });
    }
}

module.exports = new JobProducer();
