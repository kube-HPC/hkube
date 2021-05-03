const { Producer } = require('@hkube/producer-consumer');
const log = require('@hkube/logger').GetLogFromContainer();
const component = require('../consts/componentNames').JOBS_PRODUCER;

class JobProducer {
    async init(options) {
        this._producer = new Producer({
            setting: {
                redis: options.redis,
                ...options.jobs.producer
            }
        });
    }

    async createJob({ queueId, action, algorithmName }) {
        try {
            const options = {
                job: {
                    type: queueId,
                    data: {
                        action,
                        algorithmName
                    }
                }
            };
            await this._producer.createJob(options);
        }
        catch (e) {
            log.throttle.error(e.message, { component }, e);
        }
    }
}

module.exports = new JobProducer();
