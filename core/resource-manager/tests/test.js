
const chai = require('chai');
const expect = chai.expect;
const sinon = require('sinon');
const mockery = require('mockery');
const adapterController = require('../lib/adapters/adapters-controller');
const metricsRunner = require('../lib/metrics/metrics-runner');
const resourceDecider = require('../lib/resource-handlers/resource-decider');
const configIt = require('@hkube/config');
const { main, logger } = configIt.load();

describe('Test', function () {
    before(async () => {
        mockery.enable({
            useCleanCache: false,
            warnOnReplace: true,
            warnOnUnregistered: false
        });

        main.metrics.forEach(m => {
            mockery.registerSubstitute(`${process.cwd()}/lib/adapters/${m.name}`, `${process.cwd()}/tests/mocks/adapters/${m.name}.js`);
        });

        adapterController.init(main);
        metricsRunner.init(main);
        resourceDecider.init(main);
    })
    describe('Producer', function () {
        describe('CreateJob', function () {
            it('should create job and return job id', async function () {
                const data = await adapterController.getData();
                const keys = adapterController._adapters.map(a => a.name);
                expect(data).to.have.deep.keys(keys);
            });
            it('should create job and return job id', async function () {
                const adaptersResults = await adapterController.getData();
                const metricsResults = metricsRunner.run(adaptersResults);
            });
        });
        describe('CreateJob', function () {
            it('should create job and return job id', async function () {
                const adaptersResults = await adapterController.getData();
                const data = await resourceDecider.run(adaptersResults);
                const keys = adapterController._adapters.map(a => a.name);
                expect(data).to.have.deep.keys(keys);
            });
            it('should create job and return job id', async function () {
                const adaptersResults = await adapterController.getData();
                const metricsResults = metricsRunner.run(adaptersResults);
            });
        });
    });
});
