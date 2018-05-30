const storeManager = require('../store/store-manager');
const triggerQueue = require('../queue/trigger-queue');
const log = require('@hkube/logger').GetLogFromContainer();
const { componentName } = require('../consts/index');

class PipelineTrigger {
    init() {
        log.info('pipeline trigger initiated successfully', { component: componentName.PIPELINE_TRIGGER });
        this._watchJobResults();
    }

    _watchJobResults() {
        storeManager.on('result-change', (result, pipeline) => {
            this._runPipeline(result, pipeline);
        });
    }

    _runPipeline(result, pipeline) {
        if (result.data && pipeline.triggers && pipeline.triggers.pipelines) {
            pipeline.triggers.pipelines.forEach((name) => {
                log.info(`new pipeline with name ${result.pipeline} was ended and triggered pipeline ${name}`, { component: componentName.PIPELINE_TRIGGER });
                triggerQueue.addTrigger({ name, jobId: result.jobId });
            });
        }
    }
}

module.exports = new PipelineTrigger();
