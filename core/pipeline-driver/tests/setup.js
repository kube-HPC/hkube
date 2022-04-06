
const configIt = require('@hkube/config');
const storageManager = require('@hkube/storage-manager');
const { Factory } = require('@hkube/redis-utils');
const bootstrap = require('../bootstrap');
const stateManager = require('../lib/state/state-manager');
const { main: config } = configIt.load();
const dbConnect = require('@hkube/db');

before(async () => {
    const { provider, ...options } = config.db;
    this._db = dbConnect(options, provider);
    await this._db.init({ createIndices: true });
    await storageManager.init(config, null, true);
    await bootstrap.init();
    const redis = Factory.getClient(config.redis);
    await redis.flushall();
    await stateManager._etcd._client.client.delete().all()

    global.testParams = {
        config
    }
});
