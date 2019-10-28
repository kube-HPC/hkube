const mockery = require('mockery');
const stateManager = require('../lib/state/state-manager');
const { algorithms, pipelines, webhookStub } = require('./mocks');

before(async function () {
    this.timeout(10000);
    mockery.enable({
        warnOnReplace: false,
        warnOnUnregistered: false,
        useCleanCache: false
    });
    mockery.registerSubstitute('@octokit/rest', process.cwd() + '/tests/mocks/octokit.js');
    const bootstrap = require('../bootstrap');
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
