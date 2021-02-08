const { default: axios } = require('axios');
const querystring = require('query-string');
class DataSources {
    init(config) {
        const { protocol, host, port, prefix } = config.dataSourceService;
        this._baseUrl = `${protocol}://${host}:${port}/${prefix}`;
        this.client = axios.create({ baseURL: this._baseUrl });
    }

    async validate({ id, name, snapshot }) {
        const qs = querystring.stringify({
            id,
            name,
            snapshot_name: snapshot?.name
        }, { skipNull: true });
        let response;
        let error = null;
        try {
            response = await this.client.get(`/datasource/validate?${qs}`);
        }
        catch (err) {
            error = err.response?.data?.error?.message || err.response?.message || err.message;
        }
        if (!error) {
            response = response.data;
        }
        return { error, response };
    }
}

module.exports = new DataSources();
