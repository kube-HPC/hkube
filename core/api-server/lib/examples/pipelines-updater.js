const log = require('@hkube/logger').GetLogFromContainer();
const algorithms = require('./algorithms.json');
const pipelines = require('./pipelines.json');
const drivers = require('./drivers.json');
const pipelineStore = require('../service/pipelines');
const algorithmStore = require('../service/algorithms');
const stateManager = require('../state/state-manager');

class PipelinesUpdater {
    async init(options) {
        try {
            if (options.addDefaultAlgorithms !== 'false') {
                await Promise.all(algorithms.map(p => algorithmStore.insertAlgorithm(p)));
            }
        }
        catch (error) {
            log.warning(`failed to upload default algorithms. ${error.message}`);
        }

        try {
            await Promise.all(drivers.map((d) => {
                const { cpu, mem } = options.pipelineDriversResources;
                return stateManager.setPipelineDriverTemplate({ ...d, cpu, mem });
            }));
        }
        catch (error) {
            log.warning(`failed to upload default drivers. ${error.message}`);
        }

        try {
            const host = process.env.WEBHOOK_STUB_UI_SERVICE_HOST || 'localhost';
            const port = process.env.WEBHOOK_STUB_UI_SERVICE_PORT || 3003;

            await Promise.all(pipelines.map((p) => {
                const pipe = {
                    ...p,
                    webhooks: {
                        progress: `http://${host}:${port}/webhook/progress`,
                        result: `http://${host}:${port}/webhook/result`
                    }
                };
                return pipelineStore.insertPipeline(pipe);
            }));
        }
        catch (error) {
            log.warning(`failed to upload default pipelines. ${error.message}`);
        }
    }
}

module.exports = new PipelinesUpdater();
