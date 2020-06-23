const request = require('request-promise');
const querystring = require('querystring');

class CachingService {
    init(config) {
        const { protocol, host, port, prefix } = config.cachingServer;
        this._baseUrl = `${protocol}://${host}:${port}/${prefix}`;
    }

    async exec(options) {
        const { jobId, nodeName } = options;
        const qs = querystring.stringify({ jobId, nodeName });
        const uri = `${this._baseUrl}?${qs}`;
        let error;
        let pipeline;
        try {
            pipeline = await request({
                method: 'GET',
                uri,
                json: true
            });
        }
        catch (e) {
            error = e.response ? e.response.body.error : e.error;
        }
        return { error, pipeline };
    }
}

module.exports = new CachingService();
