const utils = require('../utils/utils');
const Cache = require('../cache/cache-provider');

class Adapter {

    constructor(settings, options) {
        this.name = utils.capitalize(options.name);
        this.cache = new Cache({ key: this.name, ...options.cache });
    }
}

module.exports = Adapter;