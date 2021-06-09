const fs = require('fs-extra');
const cronstrue = require('cronstrue');
const log = require('@hkube/logger').GetLogFromContainer();
const CLEANERS_PATH = 'lib/cleaners';

class CleanerManager {
    constructor() {
        this._cleaners = new Map();
    }

    // dynamically load all cleaners
    async init(options) {
        const cleaners = await fs.readdir(CLEANERS_PATH);
        cleaners.forEach(name => {
            const config = options.cleanerSettings[name];
            if (config.enabled) {
                const Cleaner = require(`../../${CLEANERS_PATH}/${name}`); // eslint-disable-line
                const cleaner = new Cleaner({ config, name });
                cleaner.start();
                this._cleaners.set(name, cleaner);
                log.info(`initialized ${name} cleaner with cron ${this._cronFormat(config.cron)} next: ${cleaner.nextDate()}`);
            }
            else {
                log.info(`skipped ${name} cleaner with cron ${this._cronFormat(config.cron)}`);
            }
        });
    }

    _cronFormat(cron) {
        return `${cronstrue.toString(cron)} (${cron})`;
    }

    checkHealth() {
        const cleaners = this.getCleaners();
        return cleaners.every(c => c.isHealthy());
    }

    getStatus(type) {
        const cleaner = this.getCleaner(type);
        return cleaner.getStatus();
    }

    getStatuses() {
        const types = this._getTypes();
        return types.map(t => this.getStatus(t));
    }

    async clean({ type, maxAge }) {
        const cleaner = this.getCleaner(type);
        const result = await cleaner.clean({ maxAge });
        return result;
    }

    async cleanAll({ maxAge }) {
        const types = this._getTypes();
        return Promise.all(types.map(type => this.clean({ type, maxAge })));
    }

    async dryRun({ type, maxAge }) {
        const cleaner = this.getCleaner(type);
        const result = await cleaner.dryRun({ maxAge });
        return result;
    }

    async dryRunAll({ maxAge }) {
        const types = this._getTypes();
        return Promise.all(types.map(type => this.dryRun({ type, maxAge })));
    }

    getCleaner(type) {
        const cleaner = this._cleaners.get(type);
        if (!cleaner) {
            throw new Error(`cleaner type is invalid (${this._getTypes()})`);
        }
        return cleaner;
    }

    getCleaners() {
        const types = this._getTypes();
        return types.map(t => this.getCleaner(t));
    }

    _getTypes() {
        return Array.from(this._cleaners.keys());
    }
}

module.exports = new CleanerManager();
