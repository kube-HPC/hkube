// const delay = require('await-delay');
const {componentName} = require('./consts/index');
const pipelineProducer = require('./pipeline-producer');
const log = require('@hkube/logger').GetLogFromContainer();
const {queue} = require('async');
// const INTERVAL = 500;
class TriggerRunner {
    constructor() {
        this.triggerMap = [];
        this.config = null;
    }
    async init(config) {
        log.info('trigger-runner is started', { component: componentName.TRIGGER});
        this.config = config;
        this.runQueue();
    }
    async runQueue() {
        this.queue = queue(async (task, callback) => {
            await pipelineProducer.produce(task);
            log.info(`prpeline ${task.pipelineName} sent successfully`, { component: componentName.TRIGGER});
            callback();
        }, 1);
    }

    async addTrigger(tasks, callback) {
        log.info(`task added to queue with ${task.pipelineName}`, { component: componentName.TRIGGER});
        this.queue.push(tasks, (err) => {
            log.info(`prpeline ${task.pipelineName} sent to api server`, { component: componentName.TRIGGER});
            callback();
        });        
    }
}
module.exports = new TriggerRunner();
