const bootstrap = require('../bootstrap');
const stateManager = require('../lib/state/state-manager');
const { algorithms, pipelines, webhookStub } = require('./mocks');

before(async function () {
    this.timeout(5000);
    const config = await bootstrap.init();
    await Promise.all(pipelines.map(p => stateManager.setPipeline(p)));
    await Promise.all(algorithms.map(p => stateManager.setAlgorithm(p)));
    webhookStub.start();

    const baseUrl = `${config.swagger.protocol}://${config.swagger.host}:${config.swagger.port}`;
    const restUrl = `${baseUrl}/${config.rest.prefix}/v1`;
    const internalUrl = `${baseUrl}/internal/v1`;

    global.testParams = {
        restUrl,
        internalUrl
    }
});
