const {CronJob} = require('cron');
const {componentName} = require('../consts/index');
const log = require('@hkube/logger').GetLogFromContainer();

// task:{
//     cronTime:'00 30 11 * * 1-5',
//     triggerPipeline:'pipelineName',
// }
class CronTask {
    constructor() {
        this.tasks = [];
    }
    init(triggers = []) {
        triggers.forEach(trigger => this.addTrigger(trigger));
    }
    addTrigger(task) {
        const job = new CronJob({
            cronTime: task.cronTime,
            onTick: () => {
                log.info(`cron job with ${task.triggerPipeline} Is Executed acording to schedule ${task.cronTime}`, { component: componentName.CRON});
            },
        });
        this.tasks.push({task, job});
    }
    removeTask(pipelineName) {
        this.tasks = this.tasks.filter(t => t.task.triggerPipeline !== pipelineName);
    }
}


module.exports = CronTask;
