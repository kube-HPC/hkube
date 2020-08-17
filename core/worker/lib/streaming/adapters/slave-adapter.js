const stateAdapter = require('../../states/stateAdapter');

class SlaveAdapter {

    constructor() {

    }

    report(data) {
        stateAdapter.reportStats(data);
    }
}

module.exports = SlaveAdapter;
