
const Adapter = require('./Adapter');
const store = require('../data/templates-store.json');

class TemplatesStore extends Adapter {

    constructor(settings, options) {
        super(settings);
    }

    async getData() {
        return store;
    }
}

module.exports = TemplatesStore;