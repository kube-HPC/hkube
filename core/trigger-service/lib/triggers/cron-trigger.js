const { CronJob } = require('cron');
const { componentName } = require('../consts/index');
const { prefix, suffix } = require('../consts/stored-pipeline-events');
const log = require('@hkube/logger').GetLogFromContainer();
const triggerQueue = require('../queue/trigger-queue');
const storedPipelineListener = require('../pipelines/stored-pipelines-listener');

class CronTask {
    constructor() {
        this._crons = new Map();
    }

    async init() {
        storedPipelineListener.on(prefix.CHANGE, t => this._updateTrigger(t));
        storedPipelineListener.on(prefix.DELETE, t => this._removeTrigger(t));
        const triggers = await storedPipelineListener.getTriggeredPipelineByType(suffix.CRON);
        triggers.forEach(t => this._updateTrigger(t));
    }

    _updateTrigger(trigger) {
        if (!trigger.cron) {
            this._removeTrigger(trigger);
            return;
        }
        this._stopCron(trigger.name);
        try {
            const cron = new CronJob(trigger.cron, () => this._onTick(trigger), null, true);
            this._crons.set(trigger.name, cron);
            log.info(`update cron job with pipeline ${trigger.name} (${trigger.cron}), total cron jobs: ${this._crons.size}`, { component: componentName.CRON });
        }
        catch (e) {
            log.info(`cron pattern not valid for pipeline ${trigger.name} (${trigger.cron})`, { component: componentName.CRON });
            this._removeTrigger(trigger);
        }
    }

    _onTick(trigger) {
        log.info(`cron job with ${trigger.name} is executed according to schedule ${trigger.cron}`, { component: componentName.CRON });
        triggerQueue.addTrigger({ name: trigger.name, jobId: 'cron' });
    }

    _removeTrigger(trigger) {
        const cron = this._stopCron(trigger.name);
        if (cron) {
            this._crons.delete(trigger.name);
            log.info(`remove cron trigger with name ${trigger.name}, cron jobs left: ${this._crons.size}`, { component: componentName.CRON });
        }
    }

    _stopCron(trigger) {
        const cron = this._crons.get(trigger);
        if (cron) {
            cron.stop();
        }
        return cron;
    }
}

module.exports = new CronTask();
