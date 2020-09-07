const Etcd = require('@hkube/etcd');
const storageManager = require('@hkube/storage-manager');
const { tracer } = require('@hkube/metrics');

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
        const result = await this.jobs.results.get(options);
        return this.getResultFromStorage(result);
    }

    async getJobResults(options) {
        const list = await this.jobs.results.list(options);
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
