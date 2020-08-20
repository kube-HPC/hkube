const Adapter = require('./adapter');
const stateAdapter = require('../../states/stateAdapter');

class SlaveAdapter extends Adapter {
    report(data) {
        stateAdapter.reportStreamingStats({ ...data, jobId: this.jobId, source: this.source });
    }

    finish() {
        return null;
    }
}

module.exports = SlaveAdapter;
