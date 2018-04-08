
const chai = require('chai');
const expect = chai.expect;
const sinon = require('sinon');
const mockery = require('mockery');
const utils = require('../lib/utils/utils');
const AdapterController = require('../lib/adapters/adapters-controller');
const MetricsRunner = require('../lib/metrics/metrics-runner');
const metricsReducer = require('../lib/metrics/metrics-reducer');
const AlgorithmRatios = require('../lib/resources/ratios-allocator');
const ResourceAllocator = require('../lib/resources/resource-allocator');
const ResourceCounter = require('../lib/resources/resource-counter');
// const intervalRunner = require('../lib/interval/runner');
const metricsProvider = require('../lib/monitoring/metrics-provider');
const configIt = require('@hkube/config');
const { main, logger } = configIt.load();

describe('Test', function () {
    before(async function () {
        mockery.enable({
            useCleanCache: false,
            warnOnReplace: false,
            warnOnUnregistered: false
        });
        process.on('unhandledRejection', (error, promise) => {
            console.error(error);
        });
        mockery.registerSubstitute('@hkube/prometheus-client', `${process.cwd()}/tests/mocks/adapters/prometheus-client-mock.js`);
        mockery.registerSubstitute('kubernetes-client', `${process.cwd()}/tests/mocks/adapters/kubernetes-client-mock.js`);
        mockery.registerSubstitute('../state/state-manager', `${process.cwd()}/tests/mocks/adapters/state-manager.js`);
        await metricsProvider.init(main);
        // await intervalRunner.init(main);
    })
    describe('Adapters', function () {
        describe('adapterController', function () {
            it('should get adapters data with the right keys', async function () {
                const adapterController = new AdapterController(main);
                const data = await adapterController.getData();
                const keys = adapterController._adapters.map(a => a.name);
                expect(data).to.have.deep.keys(keys);
            });
        });
        describe('AlgorithmQueue', function () {
            it('should get adapter data', async function () {
                const adapterController = new AdapterController(main);
                const adapter = adapterController._adapters.find(a => a.name === 'algorithmQueue');
                const data = await adapter.getData();
                expect(data).to.be.an('array');
            });
        });
        describe('K8s', function () {
            it('should get adapter data', async function () {
                const adapterController = new AdapterController(main);
                const adapter = adapterController._adapters.find(a => a.name === 'k8s');
                const data = await adapter.getData();
                expect(data).to.be.an('Map');
            });
        });
        describe('Prometheus', function () {
            it('should get adapter data', async function () {
                const adapterController = new AdapterController(main);
                const adapter = adapterController._adapters.find(a => a.name === 'prometheus');
                const data = await adapter.getData();
                expect(data).to.be.an('array');
            });

        });
        describe('TemplatesStore', function () {
            it('should get adapter data', async function () {
                const adapterController = new AdapterController(main);
                const adapter = adapterController._adapters.find(a => a.name === 'templatesStore');
                const data = await adapter.getData();
                expect(data).to.be.an('object');
            });
        });
    });
    describe('Metrics', function () {
        describe('MetricsReducer', function () {
            it('should create job and return job id', function () {
                const options = {};
                expect(() => new MetricsRunner(options)).to.throw(`metrics`);
            });
            it('should reduce the metrics results', async function () {
                const adapterController = new AdapterController(main);
                const metricsRunner = new MetricsRunner(main);
                const adaptersResults = await adapterController.getData();
                const metricsResults = metricsRunner.run(adaptersResults);
                const resourceResults = metricsReducer.reduce(metricsResults);
                expect(resourceResults).to.be.an('array');
            });
        });
        describe('MetricsRunner', async function () {
            it('should throw metrics ReferenceError', function () {
                const options = {};
                expect(() => new MetricsRunner(options)).to.throw(`metrics`);
            });
            it('should throw total score error', function () {
                const options = {
                    metrics: [{
                        name: 'templates-store',
                        weight: 0.8
                    },
                    {
                        name: 'algorithm-queue',
                        weight: 0.7
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
    describe('AlgorithmRatios', function () {
        it('should generate random allocations', async function () {
            const adapterController = new AdapterController(main);
            const adaptersResults = await adapterController.getData();
            const allocations = utils.group(adaptersResults.algorithmQueue, 'name');
            const keys = Object.keys(allocations);
            const algorithms = adaptersResults.prometheus.filter(p => keys.includes(p.algorithmName)).map(p => ({ name: p.algorithmName, value: p.runTime }));
            const algorithmRatios = new AlgorithmRatios({ algorithms, allocations });
            const algorithmGen = algorithmRatios.generateRandom();
            while (algorithmGen.next().value) {
                // while we have random algorithms allocation
            }
            expect(algorithmRatios._totalAllocations).to.equal(0);
        });
    });
    describe('ResourceAllocator', function () {
        it('should allocate successfully', async function () {
            const adapterController = new AdapterController(main);
            const adaptersResults = await adapterController.getData();
            const resourceAllocator = new ResourceAllocator({ resourceThresholds: main.resourceThresholds, ...adaptersResults });
            const algorithms = Object.keys(adaptersResults.templatesStore);
            resourceAllocator.allocate(algorithms[0]);
            resourceAllocator.allocate(algorithms[1]);
            resourceAllocator.allocate(algorithms[2]);
            const results = resourceAllocator.results();
            expect(results[0].name).to.equal(algorithms[0]);
            expect(results[1].name).to.equal(algorithms[1]);
            expect(results[2].name).to.equal(algorithms[2]);
            expect(results[0].data).to.equal(1);
            expect(results[1].data).to.equal(1);
            expect(results[2].data).to.equal(1);
        });
    });
    describe('Monitoring', function () {
        it('should run the metricsProvider', function () {
            this.timeout(50000);
            return new Promise(async function (resolve, reject) {
                const adapterController = new AdapterController(main);
                const metricsRunner = new MetricsRunner(main);
                const adaptersResults = await adapterController.getData();
                const metricsResults = metricsRunner.run(adaptersResults);
                const resourceResults = metricsReducer.reduce(metricsResults);
                metricsProvider.setPodsAllocations(resourceResults);
                resolve();

                // setTimeout(() => {
                //     resolve();
                // }, 20000)
            });

        });
    });
    describe('Interval', async function () {
        it('should throw metrics ReferenceError', function () {
            // intervalRunner._doWork();
        });
    });
});
