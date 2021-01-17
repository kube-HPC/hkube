const { default: axios } = require('axios');
const querystring = require('query-string');

class DataSources {
    init(config) {
        const { protocol, host, port, prefix } = config.dataSourceService;
        this._baseUrl = `${protocol}://${host}:${port}/${prefix}`;
        this.client = axios.create({ baseURL: this._baseUrl });
    }

    async validate(dataSources) {
        let error;
        let response;
        try {
            response = await Promise.all(dataSources.map(({ id, name, snapshot }) => {
                const qs = querystring.stringify({
                    id,
                    name,
                    snapshot_name: snapshot?.name
                }, { skipNull: true });
                return this.client.get(`/datasource/validate?${qs}`);
            }));
        }
        catch (err) {
            error = err.response?.data?.error?.message || err.response?.message || err.message;
        }
        return { error, response };
    }
}

module.exports = new DataSources();
