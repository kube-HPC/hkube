const {CronJob} = require('cron');
const {componentName, storedPipelineEvents} = require('../consts/index');
const log = require('@hkube/logger').GetLogFromContainer();
const triggerQueue = require('../trigger-queue');
const storedPipelineListener = require('../stored-pipelines-listener');
// task:{
//     cronTime:'00 30 11 * * 1-5',
//     triggerPipeline:'pipelineName',
// }
class CronTask {
    constructor() {
        this.tasks = [];
    }
    async init() {
        storedPipelineListener.on(storedPipelineEvents.prefix.CHANGE, t => this.addTrigger(t));
        storedPipelineListener.on(storedPipelineEvents.prefix.DELETE, t => this.removeTask(t.pipelineName));
        const triggers = await storedPipelineListener.getTriggeredPipelineByType(storedPipelineEvents.suffix.CRON);
        triggers.forEach(t => this.addTrigger(t));
    }
    addTrigger(task) {
        const job = new CronJob(task.triggers.cron, () => {
            triggerQueue.addTrigger({name: task.name, flowInput: []}, err => log.error(`${err}`, { component: componentName.CRON}));
            log.info(`cron job with ${task.name} Is Executed acording to schedule ${task.triggers.cron}`, { component: componentName.CRON});
        }, null, true);
        this.tasks.push({task, job});
    }
    removeTask(pipelineName) {
        this.tasks = this.tasks.filter(t => t.task.triggerPipeline !== pipelineName);
    }
}


module.exports = new CronTask();
