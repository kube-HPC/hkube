const logger = require('@hkube/logger');
const storeManager = require('../store/store-manager');
const triggerQueue = require('../queue/trigger-queue');
const { componentName, Events, Triggers } = require('../consts');
let log;

class PipelineTrigger {
    init() {
        log = logger.GetLogFromContainer();
        this._watchJobResults();
    }

    _watchJobResults() {
        storeManager.on(Events.RESULTS, (result) => {
            this._runPipeline(result);
        });
    }

    async _runPipeline(result) {
        if (!result.data) {
            return;
        }
        const pipelines = await storeManager.searchPipelines({ triggersPipeline: result.pipeline });
        pipelines.forEach((p) => {
            log.info(`pipeline with name ${result.pipeline} was ended and triggered pipeline ${p.name}`, { component: componentName.PIPELINE_TRIGGER });
            triggerQueue.addTrigger({ name: p.name, jobId: result.jobId, type: Triggers.TRIGGER });
        });
    }
}

module.exports = new PipelineTrigger();
