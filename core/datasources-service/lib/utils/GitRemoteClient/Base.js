const Log = require('@hkube/logger');

/** @typedef {import('./../types').gitConfig} gitConfig */

class Base {
    /** @param {gitConfig} config */
    constructor(config, rawRepositoryUrl, serviceName) {
        this.config = config;
        this.rawRepositoryUrl = rawRepositoryUrl;
        this.log = Log.GetLogFromContainer(serviceName);
    }

    get repositoryUrl() {
        if (!this.rawRepositoryUrl) return null;
        const url = new URL(this.rawRepositoryUrl);
        if (this.config.token) {
            url.username = this.config.token;
        }
        return url.toString();
    }
}

module.exports = Base;
