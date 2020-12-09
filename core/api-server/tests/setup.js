const stateManager = require('../lib/state/state-manager');
const { algorithms, pipelines, experiments } = require('./mocks');

before(async function () {
    this.timeout(15000)
    const bootstrap = require('../bootstrap');
    const config = await bootstrap.init();
    await stateManager._etcd._client.client.delete().all();
    await stateManager._db.db.dropDatabase();
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
