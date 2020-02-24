const { queue } = require('async');
const logger = require('@hkube/logger');
const { componentName } = require('../consts');
const pipelineProducer = require('../pipelines/pipeline-producer');
let log;

class TriggerQueue {
    async init() {
        log = logger.GetLogFromContainer();
        this._runQueue();
    }

    _runQueue() {
        this.queue = queue((trigger, callback) => {
            log.info(`try to send pipeline ${trigger.name} to api server`, { component: componentName.TRIGGER_QUEUE });
            pipelineProducer.produce(trigger).then((response) => {
                const res = response.body.error ? response.body.error.message : response.body.jobId;
                if (response.body.error) {
                    const error = response.body.error.message || response.body.error;
                    log.error(`pipeline ${trigger.name} failed sending to api server, error: ${error}`, { component: componentName.TRIGGER_QUEUE });
                }
                else {
                    log.info(`pipeline ${trigger.name} sent to api server, response: ${res}`, { component: componentName.TRIGGER_QUEUE });
                }
                callback(null, response);
            }).catch((error) => {
                log.error(`pipeline ${trigger.name} failed sending to api server, error: ${error}`, { component: componentName.TRIGGER_QUEUE });
                callback(error);
            });
        }, 1);
    }

    addTrigger(trigger) {
        return new Promise((resolve, reject) => {
            this.queue.push(trigger, (err, response) => {
                if (err) {
                    return reject(err);
                }
                return resolve(response);
            });
        });
    }
}
module.exports = new TriggerQueue();
