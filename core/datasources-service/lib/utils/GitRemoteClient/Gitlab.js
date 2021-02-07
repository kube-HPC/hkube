const { Gitlab: GitlabClient } = require('@gitbeaker/node');
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
        if (this.config.token) {
            url.username = `test-token`;
            url.password = this.config.token;
        }
        return url.toString();
    }

    // eslint-disable-next-line
    async createRepository(name) {
        let response = null;

        if (this.config.organization) {
            this.log.debug(
                `creating repository for organization ${this.config.organization}`
            );
            response = await this.client.Projects.create({
                name,
                // repository_access_level: 'private',
            });
        } else {
            this.log.debug(`creating repository for user`);
            response = await this.client.Projects.create({
                name,
                // repository_access_level: 'private',
            });
        }

        this.rawRepositoryUrl = response.http_url_to_repo;

        if (process.env.NODE_ENV === 'test') {
            const { host } = new URL(this.config.endpoint);
            this.rawRepositoryUrl = this.rawRepositoryUrl.replace(
                this.config.test.gitlabTestEndpointToken,
                host
            );
        }

        return this.rawRepositoryUrl;
    }

    async deleteRepository() {
        throw new Error('Gitlab deleteRepository: not implemented!');
    }
}

module.exports = Gitlab;
