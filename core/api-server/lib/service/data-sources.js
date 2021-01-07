const { default: axios } = require('axios');
const querystring = require('querystring');

class DataSources {
    init(config) {
        const { protocol, host, port, prefix } = config.dataSourceService;
        this._baseUrl = `${protocol}://${host}:${port}/${prefix}`;
        this.client = axios.create({ baseURL: this._baseUrl });
    }

    /** @param {{ name: string;versionId?: string; snapshotName?:string }[] } body */
    async validate(body) {
        let error;
        let response;
        try {
            response = await Promise.all(body.map(({ name, snapshotName, versionId }) => {
                const qs = querystring.stringify({ snapshotName, versionId });
                return this.client.get(`/datasource/validate/${name}?${qs}`);
            }));
        }
        catch (err) {
            error = err.response?.data?.error || err.response.status;
        }
        return { error, response };
    }
}

module.exports = new DataSources();
