const EventEmitter = require('events');
const Etcd = require('etcd.rf');
const storedPipelinesMap = require('../service/storedPipelinesMap.js')

class StateManager extends EventEmitter {

    init({ serviceName, etcd }) {
        this._etcd = new Etcd();
        this._etcd.init({ etcd, serviceName });
        this._etcd.discovery.register({ serviceName });
        this._watchJobResults();


        // JUST FOR THIS VERSION:
        this.setPipeline({ name: storedPipelinesMap.name, data: storedPipelinesMap });
    }

    async setPipeline(options) {
        return await this._etcd.pipelines.setPipeline(options);
    }

    async getPipeline(options) {
        return await this._etcd.pipelines.getPipeline(options);
    }

    async _watchJobResults() {
        await this._etcd.jobResults.onResult((result) => {
            this.emit(`job-${result.type}`, result);
        });
    }

    async getJobResult(options) {
        return await this._etcd.jobResults.getResult(options);
    }

    async getJobStatus(options) {
        return await this._etcd.jobResults.getStatus(options);
    }

    async setJobStatus(options) {
        return await this._etcd.jobResults.setStatus(options);
    }

    async stopJob(options) {
        return await this._etcd.jobs.stop(options);
    }
}

module.exports = new StateManager();