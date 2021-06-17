const dbConnect = require('@hkube/db');

class DBConnection {
    constructor() {
        this.connection = null;
    }

    async init(options) {
        const { provider, ...config } = options.db;
        this.connection = dbConnect(config, provider);
        await this.connection.init();
    }
}

module.exports = new DBConnection();
