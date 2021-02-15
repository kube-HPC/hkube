const { default: axios } = require('axios');
const { uid } = require('@hkube/uid');

/**
 * @typedef {{
 *     id: number;
 *     name: string;
 *     sha1: string;
 *     token_last_eight: string;
 * }} Token
 */

class GitToken {
    /** @param {import('./../utils/types').config} config */
    async init(config) {
        this.config = config;
        this.token = null;
        this.hash = null;
        const {
            endpoint,
            user: { name, password },
        } = config.git.github;
        const url = new URL(endpoint);
        this.client = axios.create({
            baseURL: `${url.protocol}//${name}:${password}@${url.host}/api/v1/users/${name}/tokens`,
        });
        await this._setupToken();
    }

    /** @param {string=} name */
    async _setupToken(name) {
        /** @type {import('axios').AxiosResponse<Token>} */
        const response = await this.client.post('/', {
            name: name || `service-token-${uid()}`,
        });
        this.token = response.data;
        this.hash = this.token.sha1;
        return response.data;
    }

    async removeStoredToken() {
        return this.client.delete(`/${this.token.id}`);
    }
}

module.exports = new GitToken();
