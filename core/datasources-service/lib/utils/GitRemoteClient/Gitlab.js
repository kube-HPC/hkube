const { Gitlab: GitlabClient } = require('@gitbeaker/node');
const Base = require('./Base');

class Gitlab extends Base {
    constructor(config, rawRepositoryUrl, serviceName) {
        super(config, rawRepositoryUrl, serviceName);
        this.client = new GitlabClient({
            host: this.config.endpoint,
            token: this.config.token,
        });
    }

    // eslint-disable-next-line
    async createRepository(name) {
        throw new Error('Gitlab createRepository: not implemented!');
        // let response = null;
        // if (this.config.organization) {
        //     this.log.debug(
        //         `creating repository for organization ${this.config.organization}`
        //     );
        //     response = await this.client.Projects.create({
        //         name,
        //         repository_access_level: 'private',
        //     });
        // } else {
        //     this.log.debug(`creating repository for user`);
        //     response = await this.client.Projects.create({
        //         name,
        //         repository_access_level: 'private',
        //     });
        // }
        // return repositoryUrl;
    }

    async deleteRepository() {
        throw new Error('Gitlab deleteRepository: not implemented!');
    }
}

module.exports = Gitlab;
