const configIt = require('@hkube/config');
const { Factory } = require('@hkube/redis-utils');
const storageManager = require('@hkube/storage-manager');
const bootstrap = require('../bootstrap');
const stateAdapter = require('../lib/states/stateAdapter');
const workerCommunication = require('../lib/algorithm-communication/workerCommunication');
const config = configIt.load().main;

before(async function () {
    this.timeout(10000);
    await storageManager.init(config, null, true);
    await bootstrap.init();
    const redis = Factory.getClient(config.redis);
    await redis.flushall();
    await stateAdapter._etcd._client.client.delete().all()
    workerCommunication.adapter.start();

    global.testParams = {
        config
    }
})
