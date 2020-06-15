const stateManager = require('../lib/state/state-manager');
const { algorithms, pipelines, experiments } = require('./mocks');

before(async function () {
    this.timeout(15000)
    const bootstrap = require('../bootstrap');
    const config = await bootstrap.init();
    await stateManager._client.client.delete().all();
    await Promise.all(pipelines.map(p => stateManager.pipelines.set(p)));
    await Promise.all(algorithms.map(p => stateManager.algorithms.store.set(p)));
    await Promise.all(experiments.map(p => stateManager.experiments.set(p)));

    const baseUrl = `${config.swagger.protocol}://${config.swagger.host}:${config.swagger.port}`;
    const restUrl = `${baseUrl}/${config.rest.prefix}/v1`;
    const internalUrl = `${baseUrl}/internal/v1`;

    global.testParams = {
        restUrl,
        internalUrl,
        config
    }
});
