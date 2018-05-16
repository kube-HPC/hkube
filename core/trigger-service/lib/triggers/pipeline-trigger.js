const Etcd = require('@hkube/etcd');
const triggerQueue = require('../trigger-queue');
const log = require('@hkube/logger').GetLogFromContainer();
const { componentName } = require('../consts/index');
class PipelineTrigger {
    constructor() {
        this.etcd = new Etcd();
    }

    init(options) {
        const { etcd, serviceName } = options;
        this.etcd.init({ etcd, serviceName });
        log.info('pipeline trigger initiated successfully', { component: componentName.PIPELINE_TRIGGER });
        this._watchJobResults();
    }

    async _watchJobResults() {
        await this.etcd.jobResults.watch();

        this.etcd.jobResults.on('result-change', async (result) => {
            const pipeline = await this._getExecution({ jobId: result.jobId });
            if (result.data && pipeline.triggers && pipeline.triggers.pipelines) {
                pipeline.triggers.pipelines.forEach((name) => {
                    log.info(`new pipeline with name ${result.pipeline} was ended and triggered pipeline ${name}  `, { component: componentName.PIPELINE_TRIGGER });
                    triggerQueue.addTrigger({ name, jobId: result.jobId }, (err, res) => {
                        if (err) {
                            log.error(`failed to execute ${res.name} `, { component: componentName.PIPELINE_TRIGGER });
                        }
                        log.info(`pipeline with job with ${res.name} is executed correctly`, { component: componentName.PIPELINE_TRIGGER });
                    });
                });
            }
            //  this.emit('job-result', result);
        });
    }
    async _getExecution(options) {
        return this.etcd.execution.getExecution(options);
    }
}

module.exports = new PipelineTrigger();
