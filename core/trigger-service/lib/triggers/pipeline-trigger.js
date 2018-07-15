const storeManager = require('../store/store-manager');
const triggerQueue = require('../queue/trigger-queue');
const log = require('@hkube/logger').GetLogFromContainer();
const { componentName, Events } = require('../consts/index');

class PipelineTrigger {
    init() {
        log.info('pipeline trigger initiated successfully', { component: componentName.PIPELINE_TRIGGER });
        this._watchJobResults();
    }

    _watchJobResults() {
        storeManager.on(Events.RESULTS, (result, pipeline) => {
            this._runPipeline(result, pipeline);
        });
    }

    async _runPipeline(result, pipeline) {
        if (!result.data) {
            return;
        }
        const pipelines = await storeManager.getPipelines();
        const pipelinesWithTrigger = pipelines.filter(p => p.triggers && p.triggers.pipelines);
        pipelinesWithTrigger.forEach((p) => {
            p.triggers.pipelines.forEach(tp => {
                if (tp === pipeline.name) {
                    log.info(`pipeline with name ${pipeline.name} was ended and triggered pipeline ${p.name}`, { component: componentName.PIPELINE_TRIGGER });
                    triggerQueue.addTrigger({ name: p.name, jobId: result.jobId });
                }
            });
        });
    }
}

module.exports = new PipelineTrigger();
