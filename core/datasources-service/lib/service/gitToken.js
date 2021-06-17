const { default: axios } = require('axios');
const { uid } = require('@hkube/uid');

class GitToken {
    async init(config) {
        this.config = config;
        this.token = null;
        this.hash = null;
        const {
            endpoint,
            user: { name, password },
        } = config.git.github;
        const url = new URL(endpoint);
        url.username = name;
        url.password = password;
        this.client = axios.create({
            baseURL: new URL(`/api/v1/users/${name}/tokens`, url).toString(),
        });

        await this._setupToken();
    }

    async _setupToken(name) {
        const response = await this.client.post('', {
            name: name || `service-token-${uid()}`,
        });
        this.token = response.data;
        this.hash = this.token.sha1;
        return response.data;
    }

    async removeStoredToken() {
        if (this.token === null) return;
        await this.client.delete(`/${this.token.id}`);
        this.token = null;
        this.hash = null;
    }
}

module.exports = new GitToken();
