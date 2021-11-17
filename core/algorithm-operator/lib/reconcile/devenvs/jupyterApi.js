const { StatusCodes } = require('http-status-codes');
const axios = require('axios');
class JupiterApi {
    constructor() {
        this._options = null;
        this._apiUrl = null;
    }

    async init(options) {
        this._options = options;
        const { protocol, host, port, path } = options;
        this._apiUrl = `${protocol}://${host}:${port}/${path}/hub/api`;
        this._client = axios.create({
            baseURL: this._apiUrl,
        });
    }

    async updateToken() {
        const { username, password } = this._options;
        const res = await this._client.post('authorizations/token', {
            username,
            password
        },
        {
            json: true
        });
        this._token = res.data.token;
    }

    async create({ name }) {
        const url = `${this._apiUrl}/users/${this._options.username}/servers/${name}`;
        const { status } = await this._client.post(url, {}, { headers: this._getHeaders() });
        return status;
    }

    async list() {
        const url = `${this._apiUrl}/users/${this._options.username}`;
        try {
            const { data } = await this._client.get(url, { headers: this._getHeaders() });
            return Object.values(data.servers);
        }
        catch (error) {
            if (error?.response?.status === StatusCodes.FORBIDDEN) {
                await this.updateToken(this._options);
            }
            return [];
        }
    }

    async remove({ name }) {
        const url = `${this._apiUrl}/users/${this._options.username}/servers/${name}`;
        await this._client.delete(url, { headers: this._getHeaders() });
    }

    _getHeaders() {
        return {
            Authorization: `token ${this._token}`
        };
    }
}
module.exports = new JupiterApi();
