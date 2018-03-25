
const chai = require('chai');
const expect = chai.expect;
const sinon = require('sinon');
const mockery = require('mockery');
const adapterController = require('../lib/adapters/adapters-controller');
const metricsRunner = require('../lib/metrics/metrics-runner');
const metricsReducer = require('../lib/metrics/metrics-reducer');
const ResourceAllocator = require('../lib/resource-handlers/resource-allocator');
const ResourceCounter = require('../lib/resource-handlers/resource-counter');
const configIt = require('@hkube/config');
const { main, logger } = configIt.load();

describe('Test', function () {
    before(function () {
        mockery.enable({
            useCleanCache: true,
            warnOnReplace: true,
            warnOnUnregistered: false
        });
        mockery.registerSubstitute('@hkube/prometheus-client', `${process.cwd()}/tests/mocks/adapters/prometheus-client-mock.js`);
        mockery.registerSubstitute('kubernetes-client', `${process.cwd()}/tests/mocks/adapters/kubernetes-client-mock.js`);
        mockery.registerSubstitute('../state/state-manager', `${process.cwd()}/tests/mocks/adapters/state-manager.js`);

        adapterController.init(main);
        metricsRunner.init(main);
    })
    describe('Adapters', function () {
        describe('adapterController', function () {
            it('should create job and return job id', async function () {
                const data = await adapterController.getData();
                const keys = adapterController._adapters.map(a => a.name);
                expect(data).to.have.deep.keys(keys);
            });
            it('should create job and return job id', async function () {

            });
            it('should create job and return job id', async function () {

            });
            it('should create job and return job id', async function () {
            });
        });
        describe('AlgorithmQueue', function () {

        });
        describe('K8s', function () {

        });
        describe('Prometheus', function () {
            expect(123).to.equals(123);

        });
        describe('TemplatesStore', function () {

        });
    });
    describe('Metrics', function () {
        describe('MetricsReducer', function () {
        });
        describe('MetricsRunner', async function () {
            it('should create job and return job id', async function () {
                const adaptersResults = await adapterController.getData();
                const metricsResults = metricsRunner.run(adaptersResults);
                const resourceResults = metricsReducer.reduce(metricsResults);
            });
        });
        describe('AlgorithmQueue', function () {

        });
        describe('K8s', function () {

        });
        describe('Prometheus', function () {


        });
        describe('TemplatesStore', function () {

        });
    });
    describe('Resource-Handlers', function () {
        describe('ResourceDecider', function () {
            it('should create job and return job id', async function () {
                const adaptersResults = await adapterController.getData();
                const resourceAllocator = new ResourceAllocator(main, adaptersResults);
                resourceAllocator.allocate(ratio.algorithmName);

            });
        });
        describe('ResourceCounter', function () {

        });
    });
});
