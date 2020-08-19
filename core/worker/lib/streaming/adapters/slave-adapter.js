const Adapter = require('./adapter');
const stateAdapter = require('../../states/stateAdapter');

class SlaveAdapter extends Adapter {
    report(data) {
        stateAdapter.reportStreamingStats({ ...data, source: this.source, target: this.target });
    }

    finish() {
        return null;
    }
}

module.exports = SlaveAdapter;
