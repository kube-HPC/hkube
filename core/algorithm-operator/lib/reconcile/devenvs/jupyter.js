const axios = require('axios');

class Jupyter {
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

        // get api token
        const { username, password } = options;
        const res = await this._client.post('authorizations/token', {
            username,
            password
        },
        {
            json: true
        });
        this._token = res.data.token;
        const servers = await this.list();
        console.log(servers);
    }

    async list() {
        const url = `${this._apiUrl}/user`;
        const { data } = await this._client.get(url, { headers: this._getHeaders() });
        return data.servers;
    }

    _getHeaders() {
        return {
            Authorization: `token ${this._token}`
        };
    }
}

module.exports = new Jupyter();
