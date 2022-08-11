const { default: axios } = require('axios');
const log = require('@hkube/logger').GetLogFromContainer();
const component = require('../../../lib/consts/componentNames').GRAPHQL_SERVER;
class DataSourceQuerier {
    init(config) {
        const { protocol, host, port, prefix } = config.dataSourceService;
        this._baseUrl = `${protocol}://${host}:${port}/${prefix}`;
        this.pathGenerator = {
            dataSources: () => `${this._baseUrl}`,
            dataSourceFiles: name => `${this._baseUrl}/${name}`,
            versions: name => `${this._baseUrl}/${name}/versions`,
            snapshot: name => `${this._baseUrl}/${name}/snapshot`,
            // post
            preview: id => `${this._baseUrl}/id/${id}/snapshot/preview`,
        };
    }

    getDataSourcesList() {
        return this._getRequest(this.pathGenerator.dataSources());
    }

    getDataSource(options) {
        return this._getRequest(this.pathGenerator.dataSourceFiles(options.name), options);
    }

    getDataSourceVersions(options) {
        return this._getRequest(this.pathGenerator.versions(options.name));
    }

    getDataSourceSnapshots(options) {
        return this._getRequest(this.pathGenerator.snapshot(options.name));
    }

    postDataSourcePreviewQuery(options) {
        return this._postRequest(this.pathGenerator.preview(options.id), options);
    }

    async getDataSourcesCount() {
        const data = await this._getRequest(this.pathGenerator.dataSources());
        if (data) {
            return data.length;
        }
        return 0;
    }

    async _getRequest(url, options) {
        try {
            const { data } = await axios.get(url, { params: options });
            return data;
        }
        catch (error) {
            log.error(error.message, { component });
        }
        return null;
    }

    async _postRequest(url, options) {
        try {
            const { data } = await axios.post(url, options);
            return data;
        }
        catch (error) {
            log.error(error.message, { component });
        }
        return null;
    }
}
module.exports = new DataSourceQuerier();
