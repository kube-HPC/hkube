const stateManager = require('../lib/persistency/data-store');
const { Factory } = require('@hkube/redis-utils');
let config;
let queueRunner;
before(async function () {
    this.timeout(15000);
    const bootstrap = require('../bootstrap');
    producer = require('../lib/jobs/producer');
    config = await bootstrap.init();
    const redis = Factory.getClient(config.redis);
    await redis.flushall();
    await stateManager._etcd._client.client.delete().all();
    await stateManager._db.db.dropDatabase();
    await stateManager._db.init();
    queueRunner = require('../lib/queue-runner');
    global.testParams = {
        config
    }
});
beforeEach(async () => {
    await stateManager._db.jobs.deleteMany({}, { allowNotFound: true });
    queueRunner.queue.queue = [];
    queueRunner.preferredQueue.queue = [];
});
after(async () => {
    const redis = Factory.getClient(config.redis);
    await redis.flushall();
    await stateManager._etcd._client.client.delete().all();
    await stateManager._db.db.dropDatabase();
});