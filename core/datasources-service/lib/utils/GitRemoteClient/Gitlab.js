const { Gitlab: GitlabClient } = require('@gitbeaker/node');
const { InvalidDataError } = require('../../errors');
const Base = require('./Base');
/** @typedef {import('./../types').gitlabConfig} gitlabConfig */

/** @augments {Base<gitlabConfig>} */
class Gitlab extends Base {
    constructor(config, rawRepositoryUrl, serviceName) {
        super(config, rawRepositoryUrl, serviceName);
        this.client = new GitlabClient({
            host: this.config.endpoint,
            token: this.config.token,
        });
    }

    get repositoryUrl() {
        if (!this.rawRepositoryUrl) return null;
        const url = new URL(this.rawRepositoryUrl);
        if (this.config.token && this.config.tokenName) {
            url.username = this.config.tokenName;
            url.password = this.config.token;
        } else {
            throw new InvalidDataError("missing gitlab 'token' or 'tokenName'");
        }
        return url.toString();
    }

    // eslint-disable-next-line
    async createRepository(name) {
        let response = null;
        try {
            if (this.config.organization) {
                this.log.debug(
                    `creating repository for organization ${this.config.organization}`
                );
                response = await this.client.Projects.create({
                    name,
                    visibility: 'private',
                });
            } else {
                this.log.debug(`creating repository for user`);
                response = await this.client.Projects.create({
                    name,
                    visibility: 'private',
                });
            }
        } catch (error) {
            const { statusCode } = error.response;
            if (statusCode === 401 || error.description === 'invalid_token') {
                throw new InvalidDataError('provided invalid token');
            } else if (statusCode === 404) {
                throw new InvalidDataError('provided invalid endpoint');
            }
            throw error;
        }

        const repositoryUrl = new URL(
            `${response.path_with_namespace}.git`,
            this.config.endpoint
        );

        this.rawRepositoryUrl = repositoryUrl.toString();

        return this.rawRepositoryUrl;
    }

    async deleteRepository() {
        if (!this.rawRepositoryUrl) return null;
        const url = new URL(this.rawRepositoryUrl).pathname
            .replace(/^\//, '')
            .replace('.git', '');

        return this.client.Projects.remove(url);
    }
}

module.exports = Gitlab;
