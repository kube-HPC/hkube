const utils = require('../utils/utils');

class Adapter {

    constructor(settings, options) {
        this.name = utils.capitalize(options.name);
    }
}

module.exports = Adapter;