
const algorithms = require('./algorithms.json');
const pipelines = require('./pipelines.json');
const stateManager = require('../../lib/state/state-manager');

class PipelinesUpdater {
    init(options) {
        if (options.addDefaultAlgorithms) {
            algorithms.map(p => stateManager.setAlgorithm(p));
        }

        const host = process.env.WEBHOOK_STUB_UI_SERVICE_HOST || 'localhost';
        const port = process.env.WEBHOOK_STUB_UI_SERVICE_PORT || 3003;
        pipelines.forEach((p) => {
            p.webhooks = {
                progress: `http://${host}:${port}/webhook/progress`,
                result: `http://${host}:${port}/webhook/result`
            };
            stateManager.setPipeline(p);
        });
    }
}

module.exports = new PipelinesUpdater();
