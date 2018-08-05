const storeManager = require('../store/store-manager');
const triggerQueue = require('../queue/trigger-queue');
const log = require('@hkube/logger').GetLogFromContainer();
const { componentName, Events, Triggers } = require('../consts/index');

class PipelineTrigger {
    init() {
        log.info('pipeline trigger initiated successfully', { component: componentName.PIPELINE_TRIGGER });
        this._watchJobResults();
    }

    _watchJobResults() {
        storeManager.on(Events.RESULTS, (result) => {
            this._runPipeline(result);
        });
    }

    hasTrigger(pipeline, name) {
        return pipeline.triggers && pipeline.triggers.pipelines && pipeline.triggers.pipelines.includes(name);
    }

    async _runPipeline(result) {
        if (!result.data) {
            return;
        }
        const pipelines = await storeManager.getPipelines();
        const pipelinesWithTrigger = pipelines.filter(p => this.hasTrigger(p, result.pipeline));
        pipelinesWithTrigger.forEach((p) => {
            log.info(`pipeline with name ${result.pipeline} was ended and triggered pipeline ${p.name}`, { component: componentName.PIPELINE_TRIGGER });
            triggerQueue.addTrigger({ name: p.name, jobId: result.jobId, type: Triggers.TRIGGER });
        });
    }
}

module.exports = new PipelineTrigger();
