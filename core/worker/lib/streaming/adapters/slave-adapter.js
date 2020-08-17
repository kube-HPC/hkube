const stateAdapter = require('../../states/stateAdapter');

class SlaveAdapter {
    report(data) {
        stateAdapter.reportStreamingStats(data);
    }

    finish() {
        return null;
    }
}

module.exports = SlaveAdapter;
