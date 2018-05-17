const { queue } = require('async');
const { componentName } = require('../consts/index');
const pipelineProducer = require('../pipelines/pipeline-producer');
const log = require('@hkube/logger').GetLogFromContainer();

class TriggerQueue {
    async init() {
        log.info('trigger-runner is started', { component: componentName.TRIGGER_QUEUE });
        this._runQueue();
    }

    _runQueue() {
        this.queue = queue((trigger, callback) => {
            pipelineProducer.produce(trigger.name, trigger.jobId).then(() => {
                callback();
            });
        }, 1);
    }

    addTrigger(trigger) {
        return new Promise((resolve, reject) => {
            this.queue.push(trigger, (err) => {
                if (err) {
                    return reject(err);
                }
                return resolve(trigger);
            });
        });
    }
}
module.exports = new TriggerQueue();
