const dbConnect = require('@hkube/db');

class DBConnection {
    constructor() {
        this.db = {};
    }

    async init(options) {
        const { provider, ...config } = options.db;
        const db = dbConnect(config, provider);
        await db.init();
        Object.assign(this.db, db);
    }
}

module.exports = new DBConnection();
