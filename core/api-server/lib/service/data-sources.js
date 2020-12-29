const request = require('request-promise');

class DataSources {
    init(config) {
        const { protocol, host, port, prefix } = config.dataSourceService;
        this._baseUrl = `${protocol}://${host}:${port}/${prefix}`;
    }

    async validate(body) {
        let error;
        let response;
        try {
            response = await request({
                method: 'POST',
                body,
                uri: this._baseUrl,
                json: true
            });
        }
        catch (e) {
            error = e.response?.body?.error || e.error;
        }
        return { error, response };
    }
}

module.exports = new DataSources();
