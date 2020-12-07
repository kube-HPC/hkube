const Etcd = require('@hkube/etcd');
const storageManager = require('@hkube/storage-manager');
const { tracer } = require('@hkube/metrics');
const db = require('../db');

class StateManager {
    async init(options) {
        const etcd = new Etcd(options.etcd);
        Object.assign(this, etcd);
        await this._watch();
        await this.discovery.register({ serviceName: options.serviceName, data: options });
    }

    async _watch() {
        await this.algorithms.builds.singleWatch();
        await this.jobs.results.singleWatch();
        await this.jobs.status.singleWatch();
    }

    async getJobResult(options) {
        const result = await db.jobs.fetchResult(options);
        return this.getResultFromStorage(result);
    }

    async mergeJobStorageResults(list) {
        return Promise.all(list.map(r => this.getResultFromStorage(r)));
    }

    async getResultFromStorage(options) {
        if (options && options.data && options.data.storageInfo) {
            try {
                const data = await storageManager.get(options.data.storageInfo, tracer.startSpan.bind(tracer, { name: 'storage-get-result' }));
                return { ...options, data, storageModule: storageManager.moduleName };
            }
            catch (error) {
                return { error: new Error(`failed to get from storage: ${error.message}`) };
            }
        }
        return options;
    }
}

module.exports = new StateManager();
