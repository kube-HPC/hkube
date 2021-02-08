const { Octokit } = require('@octokit/rest');
const Base = require('./Base');
/** @typedef {import('./../types').githubConfig} githubConfig */

/** @augments {Base<githubConfig>} */
class Github extends Base {
    constructor(config, rawRepositoryUrl, serviceName) {
        super(config, rawRepositoryUrl, serviceName);
        this.client = new Octokit({
            baseUrl: new URL('api/v1', this.config.endpoint).toString(),
            auth: this.config.token,
        });
    }

    get repositoryUrl() {
        if (!this.rawRepositoryUrl) return null;
        const url = new URL(this.rawRepositoryUrl);
        if (this.config.token) {
            url.username = this.config.token;
        }
        return url.toString();
    }

    async createRepository(name) {
        let response = null;
        if (this.config.organization) {
            this.log.debug(
                `creating repository for organization ${this.config.organization}`
            );
            response = await this.client.repos.createInOrg({
                name,
                org: this.config.organization,
                private: true,
            });
        } else {
            this.log.debug(`creating repository for user`);
            response = await this.client.repos.createForAuthenticatedUser({
                private: true,
                name,
            });
        }
        this.rawRepositoryUrl = response.data.clone_url;
        return this.rawRepositoryUrl;
    }

    async deleteRepository() {
        throw new Error('Github deleteRepository: not implemented!');
    }
}

module.exports = Github;
