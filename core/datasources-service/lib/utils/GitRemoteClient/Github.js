const { Octokit } = require('@octokit/rest');
const { InvalidDataError } = require('../../errors');
const Base = require('./Base');
const gitToken = require('./../../service/gitToken');

/** @typedef {import('./../types').githubConfig} githubConfig */

/** @augments {Base<githubConfig>} */
class Github extends Base {
    constructor(config, rawRepositoryUrl, serviceName) {
        super(config, rawRepositoryUrl, serviceName);
        this.token = config.token;
        if (config.kind === 'internal') {
            this.token = gitToken.hash;
        }
        this.client = new Octokit({
            baseUrl: new URL('api/v1', this.config.endpoint).toString(),
            auth: this.token,
        });
    }

    get repositoryUrl() {
        if (!this.rawRepositoryUrl) return null;
        const url = new URL(this.rawRepositoryUrl);
        if (this.token) {
            url.username = this.token;
        }
        return url.toString();
    }

    async createRepository(name) {
        let response = null;
        try {
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
        } catch (error) {
            switch (error.status) {
                case 500:
                case 404:
                    throw new InvalidDataError(
                        `Invalid Git endpoint or organization name`
                    );
                case 401:
                    throw new InvalidDataError(`Invalid git token`);
                default:
                    throw error;
            }
        }
        // Avoid using the clone_url it cannot be trusted.
        // it requires the git server to have the right host set
        const repositoryUrl = new URL(
            `${response.data.full_name}.git`,
            this.config.endpoint
        );
        this.rawRepositoryUrl = repositoryUrl.toString();
        return this.rawRepositoryUrl;
    }

    async deleteRepository(name) {
        let owner;
        if (this.config.organization) {
            owner = this.config.organization;
        } else {
            const user = await this.client.request('GET /user');
            // @ts-ignore
            owner = user.data.username;
        }
        return this.client.repos.delete({
            repo: name,
            owner,
        });
    }
}

module.exports = Github;
