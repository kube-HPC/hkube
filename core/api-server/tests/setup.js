const stateManager = require('../lib/state/state-manager');
const { Factory } = require('@hkube/redis-utils');
const { algorithms, pipelines, experiments } = require('./mocks');
let config;

before(async function () {
    this.timeout(15000)
    const bootstrap = require('../bootstrap');
    config = await bootstrap.init();
    const redis = Factory.getClient(config.redis);
    await redis.flushall();
    await stateManager._etcd._client.client.delete().all();
    await stateManager._db.db.dropDatabase();
    await stateManager._db.init();
    await stateManager.createPipelines(pipelines);
    await stateManager.createAlgorithms(algorithms);
    await stateManager.createExperiments(experiments);

    const baseUrl = `${config.swagger.protocol}://${config.swagger.host}:${config.swagger.port}`;
    const restUrl = `${baseUrl}/${config.rest.prefix}/v1`;
    const internalUrl = `${baseUrl}/internal/v1`;
    global.testParams = {
        restUrl,
        internalUrl,
        config
    }
});

after(async function () {
    const redis = Factory.getClient(config.redis);
    await redis.flushall();
    await stateManager._etcd._client.client.delete().all();
    await stateManager._db.db.dropDatabase();
});
