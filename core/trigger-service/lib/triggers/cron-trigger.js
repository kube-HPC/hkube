const { CronJob } = require('cron');
const logger = require('@hkube/logger');
const { componentName, Events, Triggers } = require('../consts');
const triggerQueue = require('../queue/trigger-queue');
const storeManager = require('../store/store-manager');
const component = componentName.CRON_TRIGGER;
let log;

class CronTask {
    constructor() {
        this._crons = new Map();
    }

    async init() {
        log = logger.GetLogFromContainer();
        storeManager.on(Events.CHANGE, t => this._updateTrigger(t));
        storeManager.on(Events.DELETE, t => this._removeTrigger(t));
    }

    _updateTrigger(trigger) {
        if (!trigger.cron?.enabled) {
            this._removeTrigger(trigger);
            return;
        }
        const { name } = trigger;
        const { pattern } = trigger.cron;
        const cronData = this._crons.get(name);
        if (cronData?.pattern === pattern) {
            return;
        }
        if (cronData && cronData.pattern !== pattern) {
            this._stopCron(name);
        }
        try {
            const cron = new CronJob(pattern, () => this._onTick(trigger), null, true);
            this._crons.set(name, { cron, pattern });
            log.info(`update cron job for pipeline ${name} (${pattern}), next: ${cron.nextDate()}, total cron jobs: ${this._crons.size}`, { component });
        }
        catch (e) {
            log.error(`cron pattern not valid for pipeline ${name} (${pattern}). ${e.message}`, { component });
        }
    }

    _onTick(trigger) {
        log.debug(`cron job for pipeline ${trigger.name} is executed according to schedule ${trigger.cron.pattern}`, { component });
        triggerQueue.addTrigger({ name: trigger.name, type: Triggers.CRON });
    }

    _removeTrigger(trigger) {
        const cron = this._stopCron(trigger.name);
        if (cron) {
            this._crons.delete(trigger.name);
            log.info(`remove cron job for pipeline ${trigger.name}, cron jobs left: ${this._crons.size}`, { component });
        }
    }

    _stopCron(trigger) {
        const cronData = this._crons.get(trigger);
        if (cronData) {
            cronData.cron.stop();
            log.info(`stop cron job for pipeline ${trigger}`, { component });
        }
        return cronData;
    }
}

module.exports = new CronTask();
