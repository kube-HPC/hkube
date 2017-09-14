const EventEmitter = require('events');
const validate = require('djsv');
const schema = require('./schema');
const { Producer } = require('raf-tasq');
const consumer = require('../consumer/jobs-consumer');
const stateManager = require('../state/state-manager');

class JobProducer extends EventEmitter {

    constructor() {
        super();
    }

    init(options) {
        const setting = {};
        const res = validate(schema.properties.setting, setting);
        if (!res.valid) {
            throw new Error(res.errors[0].stack);
        }
        this._producer = new Producer({ setting: setting });
        this._producer.REs([]);
        this._producer.on('job-waiting', (jobID, jobPromise) => {
            stateManager.setWorkerState({ key: jobID, value: { status: 'waiting' } });
        }).on('job-active', (jobID, err) => {
            stateManager.setWorkerState({ key: jobID, value: { status: 'active' } });
        }).on('job-completed', (jobID, result) => {
            stateManager.setWorkerState({ key: jobID, value: { status: 'completed' } });
        }).on('job-failed', (error) => {
            stateManager.setWorkerState({ key: jobID, value: { status: 'failed' } });
        });

        consumer.on('job', async (job) => {

            stateManager.setDriverWatch({ key: job.id });

            // first we will try to get the state for this job
            let state = await stateManager.getDriverState({ key: job.id });
            if (state) {
                stateManager.setDriverState({ key: job.id, value: { status: 'recovering' } });
            }
            else {
                stateManager.setDriverState({ key: job.id, value: { status: 'starting' } });

                // Get data from Neo4j
                console.log(job)
                // format the job data
                const opt = {
                    job: {
                        type: job.type,
                        data: job.data,
                        resolveOnStart: true
                    },
                    queue: {
                        removeOnComplete: false,
                        removeOnFail: false
                    }
                }
                const result = await this._producer.createJob(opt);
                
                console.log(result);
            }
        });
    }
}

module.exports = new JobProducer();
