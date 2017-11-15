const EventEmitter = require('events');
const States = require('lib/state/States');
const groupBy = require('lodash.groupby');

class Progress {

    constructor(options) {
        this.percent = options.percent;
        this.details = options.details;
    }

    calc(node) {

    }
}

module.exports = Progress;