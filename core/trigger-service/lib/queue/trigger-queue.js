const { queue } = require('async');
const { componentName } = require('../consts/index');
const pipelineProducer = require('../pipelines/pipeline-producer');
const log = require('@hkube/logger').GetLogFromContainer();

class TriggerQueue {
    async init() {
        log.info('trigger queue is started', { component: componentName.TRIGGER_QUEUE });
        this._runQueue();
    }

    _runQueue() {
        this.queue = queue((trigger, callback) => {
            log.info(`try to send pipeline ${trigger.name} to api server`, { component: componentName.TRIGGER_QUEUE });
            pipelineProducer.produce(trigger).then((response) => {
                log.info(`pipeline ${trigger.name} sent to api server, response: ${response.body.jobId}`, { component: componentName.TRIGGER_QUEUE });
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
