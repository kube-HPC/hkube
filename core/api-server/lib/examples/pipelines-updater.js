
const algorithms = require('./algorithms.json');
const pipelines = require('./pipelines.json');
const pipelineStore = require('../service/pipelines');
const algorithmStore = require('../service/algorithms');

class PipelinesUpdater {
    async init(options) {
        try {
            if (options.addDefaultAlgorithms !== 'false') {
                await Promise.all(algorithms.map(p => algorithmStore.insertAlgorithm(p)));
            }
        }
        catch (error) { } // eslint-disable-line

        const host = process.env.WEBHOOK_STUB_UI_SERVICE_HOST || 'localhost';
        const port = process.env.WEBHOOK_STUB_UI_SERVICE_PORT || 3003;
        pipelines.forEach(async (p) => {
            try {
                p.webhooks = {
                    progress: `http://${host}:${port}/webhook/progress`,
                    result: `http://${host}:${port}/webhook/result`
                };
                await pipelineStore.insertPipeline(p);
            }
            catch (e) { } // eslint-disable-line
        });
    }
}

module.exports = new PipelinesUpdater();
