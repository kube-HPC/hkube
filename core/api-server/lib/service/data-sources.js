const request = require('request-promise');

class DataSources {
    init(config) {
        const { protocol, host, port, prefix } = config.dataSourceService;
        this._baseUrl = `${protocol}://${host}:${port}/${prefix}`;
    }

    async create(body) {
        let error;
        let pipeline;
        try {
            pipeline = await request({
                method: 'POST',
                body,
                uri: this._baseUrl,
                json: true
            });
        }
        catch (e) {
            error = e.response ? e.response.body.error : e.error;
        }
        return { error, pipeline };
    }
}

module.exports = new DataSources();
