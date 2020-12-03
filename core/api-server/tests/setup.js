const stateManager = require('../lib/state/state-manager');
const db = require('../lib/db');
const { algorithms, pipelines, experiments } = require('./mocks');

before(async function () {
    this.timeout(15000)
    const bootstrap = require('../bootstrap');
    const config = await bootstrap.init();
    await stateManager._client.client.delete().all();
    await db.db.dropDatabase();
    await db.pipelines.createMany(pipelines);
    await db.algorithms.createMany(algorithms);
    await db.experiments.createMany(experiments);

    const baseUrl = `${config.swagger.protocol}://${config.swagger.host}:${config.swagger.port}`;
    const restUrl = `${baseUrl}/${config.rest.prefix}/v1`;
    const internalUrl = `${baseUrl}/internal/v1`;
    global.testParams = {
        restUrl,
        internalUrl,
        config
    }
});
