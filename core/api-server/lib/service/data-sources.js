const { default: axios } = require('axios');

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
            response = await Promise.all(body.map(
                ({ name, snapshotName, versionId }) => (
                    (snapshotName)
                        ? this.client.get(`/datasource/${name}/snapshot/${snapshotName}`)
                        : (versionId)
                            ? this.client.get(`/datasource/${name}?version_id=${versionId}`)
                            : this.client.get(`/datasource/${name}`))
            ));
        }
        catch (err) {
            error = err.response?.data?.error || err.response.status;
        }
        return { error, response };
    }
}

module.exports = new DataSources();
