const { CronJob } = require('cron');
const { componentName, storedPipelineEvents } = require('../consts/index');
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
        if (triggers) {
            triggers.forEach(t => this.addTrigger(t));
        }
    }
    addTrigger(task, cb = () => { }) {
        log.info(`new cron task with name ${task.name} added with cron ${task.triggers.cron} `, { component: componentName.CRON });
        const job = new CronJob(task.triggers.cron, () => {
            triggerQueue.addTrigger({ name: task.name, flowInput: [], jobId: 'cron' }, (err, res) => {
                if (err) {
                    log.error(`callback sent from trigger-queue with error  ${err}`, { component: componentName.CRON });
                }
                cb(task.name);
            });
            log.info(`cron job with ${task.name} Is Executed according to schedule ${task.triggers.cron}`, { component: componentName.CRON });
        }, null, true);

        this.tasks.push({ task, job });
    }
    removeTask(pipelineName) {
        log.info(` task with name ${pipelineName} removed from cron `, { component: componentName.CRON });
        this.tasks = this.tasks.filter(t => t.task.triggerPipeline !== pipelineName);
    }
}


module.exports = new CronTask();
