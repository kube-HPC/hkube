const workerPods = require('./worker-pods.json');
const workerJobs = require('./worker-jobs.json');
const driversPods = require('./drivers-pods.json');
const buildersPods = require('./builders-pods.json');

class KubernetesMock {
    async init() {

    }

    async deleteJob() {

    }

    async getWorkerJobs() {
        return workerJobs;
    }

    async getWorkerPods() {
        return workerPods
    }

    async getPipelineDriversPods() {
        return driversPods
    }

    async getAlgorithmBuilderPods() {
        return buildersPods
    }
}

module.exports = new KubernetesMock();
