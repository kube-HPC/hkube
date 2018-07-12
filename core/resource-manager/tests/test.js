
const chai = require('chai');
const expect = chai.expect;
const sinon = require('sinon');
const mockery = require('mockery');
const Logger = require('@hkube/logger');
const configIt = require('@hkube/config');
const { main, logger } = configIt.load();
const log = new Logger(main.serviceName, logger);
const utils = require('../lib/utils/utils');
const MetricsRunner = require('../lib/metrics/metrics-runner');
const metricsReducer = require('../lib/metrics/metrics-reducer');
const AlgorithmRatios = require('../lib/resources/ratios-allocator');
const ResourceAllocator = require('../lib/resources/resource-allocator');
let intervalRunner, AdapterController;
const metricsProvider = require('../lib/monitoring/metrics-provider');

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
        mockery.registerSubstitute('../../state/state-manager', `${process.cwd()}/tests/mocks/adapters/state-manager.js`);

        AdapterController = require('../lib/adapters/adapters-controller');
        intervalRunner = require('../lib/runner/runner');
        await metricsProvider.init(main);
        await intervalRunner.init(main);
    })
    describe('Adapters', function () {
        describe('adapterController', function () {
            it('should get adapters data with the right keys', async function () {
                const adapterController = new AdapterController(main);
                const data = await adapterController.getData();
                const dataKeys = Object.keys(data.algorithms);
                const adapterKeys = Object.keys(adapterController._adapters.algorithms);
                expect(dataKeys).to.deep.equal(adapterKeys);
            });
        });
        describe('AlgorithmQueue', function () {
            it('should get adapter algorithms.queue data', async function () {
                const adapterController = new AdapterController(main);
                const adapter = adapterController._adapters.algorithms.queue;
                const data = await adapter.getData();
                expect(data).to.be.an('array');
            });
        });
        describe('K8s', function () {
            it('should get adapter algorithms.k8s data', async function () {
                const adapterController = new AdapterController(main);
                const adapter = adapterController._adapters.algorithms.k8s;
                const data = await adapter.getData();
                expect(data).to.be.an('Map');
            });
        });
        describe('Prometheus', function () {
            it('should get adapter algorithms.prometheus data', async function () {
                const adapterController = new AdapterController(main);
                const adapter = adapterController._adapters.algorithms.prometheus;
                const data = await adapter.getData();
                expect(data).to.be.an('array');
            });

        });
        describe('TemplatesStore', function () {
            it('should get adapter algorithms.templatesStore data', async function () {
                const adapterController = new AdapterController(main);
                const adapter = adapterController._adapters.algorithms.templatesStore;
                const data = await adapter.getData();
                expect(data).to.be.an('object');
            });
        });
    });
    describe('Metrics', function () {
        describe('MetricsReducer', function () {
            it('should reduce the metrics results', async function () {
                const adapterController = new AdapterController(main);
                const metricsRunner = new MetricsRunner(main);
                const adaptersResults = await adapterController.getData();
                const metricsResults = metricsRunner.run('algorithms', adaptersResults);
                const resourceResults = metricsReducer.reduce(metricsResults);
                expect(resourceResults).to.be.an('array');
            });
        });
        describe('MetricsRunner', async function () {
            it('should calc the metrics weights', async function () {
                const metricsRunner = new MetricsRunner(main);
                const weight = metricsRunner._metrics.algorithms.map(a => a.weight).reduce((a, b) => a + b, 0);
                expect(weight).to.be.closeTo(1, 0.01);
            });
            it('should run with the metrics results', async function () {
                const adapterController = new AdapterController(main);
                const metricsRunner = new MetricsRunner(main);
                const adaptersResults = await adapterController.getData();
                const metricsResults = metricsRunner.run('algorithms', adaptersResults);
                expect(metricsResults).to.be.an('array');
            });
        });
        describe('AlgorithmQueue', function () {
            it('should calc metric and return results', async function () {
                const adapterController = new AdapterController(main);
                const adaptersResults = await adapterController.getData();
                const metricsRunner = new MetricsRunner(main)
                const metric = metricsRunner._metrics.algorithms.find(a => a.name === 'queue');
                const metricResults = metric.calc(adaptersResults);
                const map = metricResults.map(m => m.name).sort();
                const algorithms = Object.keys(adaptersResults.algorithms.templatesStore).sort();
                expect(metricResults).to.be.an('array');
                expect(map).to.deep.equal(algorithms);
            });
        });
        describe('CpuUsage', function () {
            it('should return weight same as config', async function () {
                const adapterController = new AdapterController(main);
                const data = await adapterController.getData();
                const metricsRunner = new MetricsRunner(main)
                const metric = metricsRunner._metrics.algorithms.find(a => a.name === 'cpuUsage');
                expect(metric.weight).to.greaterThan(0);
            });
            it('should calc metric and return results', async function () {
                const adapterController = new AdapterController(main);
                const adaptersResults = await adapterController.getData();
                const metricsRunner = new MetricsRunner(main)
                const metric = metricsRunner._metrics.algorithms.find(a => a.name === 'cpuUsage');
                const metricResults = metric.calc(adaptersResults);
                const map = metricResults.map(m => m.name).sort();
                const algorithms = Object.keys(adaptersResults.algorithms.templatesStore).sort();
                expect(metricResults).to.be.an('array');
                expect(map).to.deep.equal(algorithms);
            });
        });
        describe('RunTime', function () {
            it('should return weight same as config', async function () {
                const adapterController = new AdapterController(main);
                const data = await adapterController.getData();
                const metricsRunner = new MetricsRunner(main)
                const metric = metricsRunner._metrics.algorithms.find(a => a.name === 'runTime');
                expect(metric.weight).to.greaterThan(0);
            });
            it('should calc metric and return results', async function () {
                const adapterController = new AdapterController(main);
                const adaptersResults = await adapterController.getData();
                const metricsRunner = new MetricsRunner(main)
                const metric = metricsRunner._metrics.algorithms.find(a => a.name === 'runTime');
                const metricResults = metric.calc(adaptersResults);
                const map = metricResults.map(m => m.name).sort();
                const algorithms = Object.keys(adaptersResults.algorithms.templatesStore).sort();
                expect(metricResults).to.be.an('array');
                expect(map).to.deep.equal(algorithms);
            });
        });
        describe('TemplatesStore', function () {
            it('should return weight same as config', async function () {
                const adapterController = new AdapterController(main);
                const data = await adapterController.getData();
                const metricsRunner = new MetricsRunner(main)
                const metric = metricsRunner._metrics.algorithms.find(a => a.name === 'templatesStore');
                expect(metric.weight).to.greaterThan(0);
            });
            it('should calc metric and return results', async function () {
                const adapterController = new AdapterController(main);
                const adaptersResults = await adapterController.getData();
                const metricsRunner = new MetricsRunner(main)
                const metric = metricsRunner._metrics.algorithms.find(a => a.name === 'templatesStore');
                const metricResults = metric.calc(adaptersResults);
                const map = metricResults.map(m => m.name).sort();
                const algorithms = Object.keys(adaptersResults.algorithms.templatesStore).sort();
                expect(metricResults).to.be.an('array');
                expect(map).to.deep.equal(algorithms);
            });
        });
    });
    describe('AlgorithmRatios', function () {
        it('should generate random allocations', async function () {
            const adapterController = new AdapterController(main);
            const adaptersResults = await adapterController.getData();
            const allocations = utils.groupBy(adaptersResults.algorithms.queue, 'name');
            const keys = Object.keys(allocations);
            const algorithms = adaptersResults.algorithms.prometheus.filter(p => keys.includes(p.algorithmName)).map(p => ({ name: p.algorithmName, value: p.runTime }));
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
            const resourceAllocator = new ResourceAllocator({ resourceThresholds: main.resourceThresholds.algorithms, ...adaptersResults.algorithms });
            const algorithms = Object.keys(adaptersResults.algorithms.templatesStore).sort();
            algorithms.forEach((a) => resourceAllocator.allocate(a));
            const results = resourceAllocator.results();
            const keys = Object.keys(results).sort();
            const values = Object.values(results).sort();
            expect(keys).to.deep.equal(algorithms);
            expect(values).to.deep.equal([1, 1, 1, 1]);
        });
    });
    describe('Monitoring', function () {
        it('should run the metricsProvider', function () {
            this.timeout(50000);
            return new Promise(async function (resolve, reject) {
                const adapterController = new AdapterController(main);
                const metricsRunner = new MetricsRunner(main);
                const adaptersResults = await adapterController.getData();
                const metricsResults = metricsRunner.run('algorithms', adaptersResults);
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
        it('should execute doWork and return results', async function () {
            const result = await intervalRunner._doWork();
            expect(result).to.be.an('array');
        });
        it('should execute _run and call _doWork once', async function () {
            const clock = sinon.useFakeTimers();
            const spy = sinon.spy(intervalRunner, '_doWork');
            intervalRunner._run(200);
            clock.tick(1000);
            clock.restore();
            expect(spy.calledOnce).to.equal(true);
        });
        it('should execute _doWork and call to _onError once', async function () {
            const clock = sinon.useFakeTimers();
            const spy = sinon.spy(intervalRunner, '_onError');
            intervalRunner._doWork = () => {
                throw new Error('some error');
            }
            intervalRunner._run(200);
            clock.tick(300);
            clock.restore();
            expect(spy.calledOnce).to.equal(true);
            expect(spy.args[0][0].message).to.equal('some error');
        });
    });
});
