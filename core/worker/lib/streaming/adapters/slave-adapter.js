const Adapter = require('./adapter');
const stateAdapter = require('../../states/stateAdapter');

/**
 * the slave is just report its statistics to the state server,
 * the master will watch and handle auto-scale for it.
 */
class SlaveAdapter extends Adapter {
    report(data) {
        stateAdapter.reportStreamingStats({
            ...data,
            jobId: this.jobId,
            source: this.source,
            timestamp: Date.now()
        });
    }

    async finish() {
        return null;
    }
}

module.exports = SlaveAdapter;
