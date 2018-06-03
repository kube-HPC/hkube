const { CronJob } = require('cron');
const { componentName, Events, Triggers } = require('../consts/index');
const log = require('@hkube/logger').GetLogFromContainer();
const triggerQueue = require('../queue/trigger-queue');
const storedPipelineListener = require('../pipelines/stored-pipelines-listener');

class CronTask {
    constructor() {
        this._crons = new Map();
    }

    async init() {
        storedPipelineListener.on(Events.CHANGE, t => this._updateTrigger(t));
        storedPipelineListener.on(Events.DELETE, t => this._removeTrigger(t));
        const triggers = await storedPipelineListener.getTriggeredPipelineByType(Triggers.CRON);
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
            log.info(`update cron job for pipeline ${trigger.name} (${trigger.cron}), total cron jobs: ${this._crons.size}`, { component: componentName.CRON });
        }
        catch (e) {
            log.error(`cron pattern not valid for pipeline ${trigger.name} (${trigger.cron})`, { component: componentName.CRON });
        }
    }

    _onTick(trigger) {
        log.debug(`cron job for pipeline ${trigger.name} is executed according to schedule ${trigger.cron}`, { component: componentName.CRON });
        triggerQueue.addTrigger({ name: trigger.name, jobId: 'cron' });
    }

    _removeTrigger(trigger) {
        const cron = this._stopCron(trigger.name);
        if (cron) {
            this._crons.delete(trigger.name);
            log.info(`remove cron job for pipeline ${trigger.name}, cron jobs left: ${this._crons.size}`, { component: componentName.CRON });
        }
    }

    _stopCron(trigger) {
        const cron = this._crons.get(trigger);
        if (cron) {
            cron.stop();
            log.info(`stop cron job for pipeline ${trigger}`, { component: componentName.CRON });
        }
        return cron;
    }
}

module.exports = new CronTask();
