const dbConnect = require('@hkube/db');

class DBConnection {
    constructor() {
        this.connection = null;
    }

    async init(options) {
        const { provider, ...config } = options.db;
        const connection = dbConnect(config, provider);
        await connection.init();
        Object.assign(this, connection);
    }
}

module.exports = new DBConnection();
