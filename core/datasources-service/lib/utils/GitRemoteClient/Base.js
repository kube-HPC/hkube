const Log = require('@hkube/logger');

/** @typedef {import('./../types').gitConfig} gitConfig */

/** @template T */
class Base {
    /** @param {T} config */
    constructor(config, rawRepositoryUrl, serviceName) {
        this.config = config;
        this.rawRepositoryUrl = rawRepositoryUrl;
        this.log = Log.GetLogFromContainer(serviceName);
    }
}

module.exports = Base;
