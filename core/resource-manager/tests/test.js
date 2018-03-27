
const chai = require('chai');
const expect = chai.expect;
const sinon = require('sinon');
const mockery = require('mockery');
const AdapterController = require('../lib/adapters/adapters-controller');
const MetricsRunner = require('../lib/metrics/metrics-runner');
const metricsReducer = require('../lib/metrics/metrics-reducer');
const ResourceAllocator = require('../lib/resource-handlers/resource-allocator');
const ResourceCounter = require('../lib/resource-handlers/resource-counter');
const intervalRunner = require('../lib/interval/runner');
const configIt = require('@hkube/config');
const { main, logger } = configIt.load();

describe('Test', function () {
    before(async function () {
        mockery.enable({
            useCleanCache: true,
            warnOnReplace: true,
            warnOnUnregistered: false
        });
        mockery.registerSubstitute('@hkube/prometheus-client', `${process.cwd()}/tests/mocks/adapters/prometheus-client-mock.js`);
        mockery.registerSubstitute('kubernetes-client', `${process.cwd()}/tests/mocks/adapters/kubernetes-client-mock.js`);
        mockery.registerSubstitute('../state/state-manager', `${process.cwd()}/tests/mocks/adapters/state-manager.js`);
        await intervalRunner.init(main);
    })
    describe('Adapters', function () {
        describe('adapterController', function () {
            it('should create job and return job id', async function () {
                const adapterController = new AdapterController(main);
                const data = await adapterController.getData();
                const keys = adapterController._adapters.map(a => a.name);
                expect(data).to.have.deep.keys(keys);
            });
            it('should create job and return job id', async function () {
                const adapterController = new AdapterController(main);
                const data = await adapterController.getData();
                const keys = adapterController._adapters.map(a => a.name);
                expect(data).to.have.deep.keys(keys);
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
            it('should create job and return job id', function () {
                const options = {};
                expect(() => new MetricsRunner(options)).to.throw(`metrics`);
            });
            it('should create job and return job id', async function () {
                const adapterController = new AdapterController(main);
                const metricsRunner = new MetricsRunner(main);
                const adaptersResults = await adapterController.getData();
                const metricsResults = metricsRunner.run(adaptersResults);
                const resourceResults = metricsReducer.reduce(metricsResults);
            });
        });
        describe('MetricsRunner', async function () {
            it('should throw metrics ReferenceError', function () {
                const options = {};
                expect(() => new MetricsRunner(options)).to.throw(`metrics`);
            });
            it('should throw total score error', function () {
                const options = {
                    resourceProviders: [{
                        name: 'templates-store',
                        metric: {
                            weight: 0.8
                        }
                    },
                    {
                        name: 'algorithm-queue',
                        metric: {
                            weight: 0.7
                        }
                    }]
                };
                expect(() => new MetricsRunner(options)).to.throw(`metrics total score must be equal to 1, current 1.5`);
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
        describe('ResourceAllocator', function () {
            it('should success to allocate resource', async function () {
                const alg = 'black-alg';
                const adapterController = new AdapterController(main);
                const adaptersResults = await adapterController.getData();
                const resourceAllocator = new ResourceAllocator(main, adaptersResults);
                resourceAllocator.allocate(alg);
                const results = resourceAllocator.results();
                expect(results[0].alg).to.equal(alg);
                expect(results[0].data).to.equal(1);
            });
        });
        describe('ResourceCounter', function () {

        });
    });
    describe('Interval', async function () {
        it('should throw metrics ReferenceError', function () {
            // intervalRunner._doWork();
        });

    });
});
