
const chai = require('chai');
const chaiAsPromised = require('chai-as-promised');
chai.use(chaiAsPromised);
const expect = chai.expect;
const sinon = require('sinon');
const mockery = require('mockery');
const Logger = require('@hkube/logger');
const configIt = require('@hkube/config');
const { main, logger } = configIt.load();
const config = main;
const log = new Logger(config.serviceName, logger);
const utils = require('../lib/utils/utils');
const adapterSettings = require('./mocks/adapters/adapter-settings');
const metricsSettings = require('./mocks/adapters/metric-settings');
const MetricsController = require('../lib/metrics/metrics-controller');
const AlgorithmRatios = require('../lib/allocators/ratios-allocator');
const ResourceAllocator = require('../lib/allocators/resource-allocator');
const metricsProvider = require('../lib/monitoring/metrics-provider');
const algorithmQueueMock = require('./mocks/data/algorithm-queue-map.json');
let intervalRunner;

const configFlat = {
    ...config,
    recommendationMode: 'flat'
}

const configMap = {
    ...config,
    recommendationMode: 'map'
}

describe('Test', function () {
    before(async function () {
        mockery.enable({
            useCleanCache: false,
            warnOnReplace: false,
            warnOnUnregistered: false
        });
        mockery.registerSubstitute('@hkube/prometheus-client', `${process.cwd()}/tests/mocks/adapters/prometheus-client-mock.js`);
        mockery.registerSubstitute('@hkube/kubernetes-client', `${process.cwd()}/tests/mocks/adapters/kubernetes-client-mock.js`);
        mockery.registerSubstitute('../../store/store-manager', `${process.cwd()}/tests/mocks/adapters/store-manager.js`);
        mockery.registerSubstitute('../store-manager', `${process.cwd()}/tests/mocks/adapters/store-manager.js`);
        mockery.registerSubstitute('../adapters/settings', `${process.cwd()}/tests/mocks/adapters/adapter-settings.js`);
        mockery.registerSubstitute('../metrics/settings', `${process.cwd()}/tests/mocks/adapters/metric-settings.js`);

        AdapterController = require('../lib/adapters/adapters-controller');
        intervalRunner = require('../lib/runner/runner');
        await metricsProvider.init(config);
    })
    describe('Adapters', function () {
        describe('adapterController', function () {
            it('should throw cache ttl invalid', function () {
                const settings = {
                    algorithms: {
                        queue: {
                            enable: true,
                            mandatory: true,
                            cacheTTL: -6
                        }
                    }
                }
                const adapterController = new AdapterController(config, settings);
                return expect(adapterController.init()).to.eventually.rejectedWith('cache ttl must be at least 1 sec');
            });
            it('should filter enable adapters only', async function () {
                const settings = {
                    algorithms: {
                        queue: {
                            enable: true,
                            cacheTTL: 0
                        },
                        prometheus: {
                            enable: false,
                            cacheTTL: 0
                        }
                    }
                }
                const adapterController = new AdapterController(config, settings);
                await adapterController.init();
                const adapterKeys = Object.keys(adapterController._adapters.algorithms);
                expect(adapterKeys).to.have.lengthOf(1);
            });
            it('should get adapters data with the right keys', async function () {
                const adapterController = new AdapterController(config, adapterSettings);
                await adapterController.init();
                const data = await adapterController.getData();
                const dataKeys = Object.keys(data.algorithms);
                const adapterKeys = Object.keys(adapterController._adapters.algorithms);
                expect(dataKeys).to.deep.equal(adapterKeys);
            });
        });
        describe('AlgorithmQueue', function () {
            it('should get adapter algorithms.queue data', async function () {
                const settings = {
                    algorithms: {
                        queue: {
                            enable: true
                        },
                        store: {
                            enable: false
                        },
                        templatesStore: {
                            enable: false
                        }
                    }
                }
                const adapterName = 'queue';
                const adapterController = new AdapterController(config, settings);
                await adapterController.init();
                const adapter = adapterController._adapters.algorithms.queue;
                const adapterKeys = Object.keys(adapterController._adapters.algorithms);
                const result = await adapter.getData();
                expect(adapter._cacheTTL).to.equal(0);
                expect(adapter._cache).to.be.null;
                expect(adapter._working).to.equal(false);
                expect(adapter.name).to.equal(adapterName);
                expect(adapter.mandatory).to.equal(false);
                expect(adapterKeys).to.have.lengthOf(1);
                expect(adapterKeys[0]).to.equal(adapterName);
                expect(result.data).to.deep.equal(algorithmQueueMock);
            });
            it('should get adapter algorithms.queue data with cache', async function () {
                const settings = {
                    algorithms: {
                        queue: {
                            enable: true,
                            cacheTTL: 30
                        },
                        store: {
                            enable: false
                        },
                        templatesStore: {
                            enable: false
                        }
                    }
                }
                const adapterName = 'queue';
                const adapterController = new AdapterController(config, settings);
                await adapterController.init();
                const adapter = adapterController._adapters.algorithms.queue;
                const adapterKeys = Object.keys(adapterController._adapters.algorithms);
                const result = await adapter.getData();
                expect(adapter._cacheTTL).to.equal(30);
                expect(adapter._working).to.equal(false);
                expect(adapter.name).to.equal(adapterName);
                expect(adapter.mandatory).to.equal(false);
                expect(adapterKeys).to.have.lengthOf(1);
                expect(adapterKeys[0]).to.equal(adapterName);
                expect(result.data).to.deep.equal(algorithmQueueMock);
                expect(adapter._cache.data).to.deep.equal(algorithmQueueMock);
            });
        });
        describe('K8s', function () {
            it('should get adapter resources.k8s data', async function () {
                const settings = {
                    resources: {
                        k8s: {
                            enable: true
                        }
                    }
                }
                const adapterName = 'k8s';
                const adapterController = new AdapterController(config, settings);
                await adapterController.init();
                const adapter = adapterController._adapters.resources.k8s;
                const adapterKeys = Object.keys(adapterController._adapters.resources);
                const result = await adapter.getData();
                expect(adapter._cacheTTL).to.equal(0);
                expect(adapter._cache).to.be.null;
                expect(adapter._working).to.equal(false);
                expect(adapter.name).to.equal(adapterName);
                expect(adapter.mandatory).to.equal(false);
                expect(adapterKeys).to.have.lengthOf(1);
                expect(adapterKeys[0]).to.equal(adapterName);
                expect(result.data).to.be.an('Map');
            });
            it('should get adapter resources.k8s data with cache', async function () {
                const settings = {
                    resources: {
                        k8s: {
                            enable: true,
                            cacheTTL: 30
                        }
                    }
                }
                const adapterName = 'k8s';
                const adapterController = new AdapterController(config, settings);
                await adapterController.init();
                const adapter = adapterController._adapters.resources.k8s;
                const adapterKeys = Object.keys(adapterController._adapters.resources);
                const result = await adapter.getData();
                expect(adapter._cacheTTL).to.equal(30);
                expect(adapter._working).to.equal(false);
                expect(adapter.name).to.equal(adapterName);
                expect(adapter.mandatory).to.equal(false);
                expect(adapterKeys).to.have.lengthOf(1);
                expect(adapterKeys[0]).to.equal(adapterName);
                expect(result.data).to.be.an('Map');
                expect(adapter._cache.data).to.be.an('Map');
            });
        });
        describe('Prometheus', function () {
            it('should get adapter algorithms.prometheus data', async function () {
                const settings = {
                    algorithms: {
                        prometheus: {
                            enable: true
                        },
                        queue: {
                            enable: false
                        },
                        store: {
                            enable: false
                        },
                        templatesStore: {
                            enable: false
                        }
                    }
                }
                const adapterName = 'prometheus';
                const adapterController = new AdapterController(config, settings);
                await adapterController.init();
                const adapter = adapterController._adapters.algorithms.prometheus;
                const adapterKeys = Object.keys(adapterController._adapters.algorithms);
                const result = await adapter.getData();
                expect(adapter._cacheTTL).to.equal(0);
                expect(adapter._cache).to.be.null;
                expect(adapter._working).to.equal(false);
                expect(adapter.name).to.equal(adapterName);
                expect(adapter.mandatory).to.equal(false);
                expect(adapterKeys).to.have.lengthOf(1);
                expect(adapterKeys[0]).to.equal(adapterName);
                expect(result.data).to.be.an('array');
            });
            it('should get adapter algorithms.prometheus data with cache', async function () {
                const settings = {
                    algorithms: {
                        prometheus: {
                            enable: true,
                            cacheTTL: 30
                        },
                        queue: {
                            enable: false
                        },
                        store: {
                            enable: false
                        },
                        templatesStore: {
                            enable: false
                        }
                    }
                }
                const adapterName = 'prometheus';
                const adapterController = new AdapterController(config, settings);
                await adapterController.init();
                const adapter = adapterController._adapters.algorithms.prometheus;
                const adapterKeys = Object.keys(adapterController._adapters.algorithms);
                const result = await adapter.getData();
                expect(adapter._cacheTTL).to.equal(30);
                expect(adapter._working).to.equal(false);
                expect(adapter.name).to.equal(adapterName);
                expect(adapter.mandatory).to.equal(false);
                expect(adapterKeys).to.have.lengthOf(1);
                expect(adapterKeys[0]).to.equal(adapterName);
                expect(result.data).to.be.an('array');
                expect(adapter._cache.data).to.be.an('array');
            });
        });
        describe('TemplatesStore', function () {
            it('should get adapter algorithms.templatesStore data', async function () {
                const settings = {
                    algorithms: {
                        templatesStore: {
                            enable: true
                        },
                        queue: {
                            enable: false
                        },
                        store: {
                            enable: false
                        }
                    }
                }
                const adapterName = 'templatesStore';
                const adapterController = new AdapterController(config, settings);
                await adapterController.init();
                const adapter = adapterController._adapters.algorithms.templatesStore;
                const adapterKeys = Object.keys(adapterController._adapters.algorithms);
                const result = await adapter.getData();
                expect(adapter._cacheTTL).to.equal(0);
                expect(adapter._cache).to.be.null;
                expect(adapter._working).to.equal(false);
                expect(adapter.name).to.equal(adapterName);
                expect(adapter.mandatory).to.equal(false);
                expect(adapterKeys).to.have.lengthOf(1);
                expect(adapterKeys[0]).to.equal(adapterName);
                expect(result.data).to.be.an('object');
            });
            it('should get adapter algorithms.templatesStore data with cache', async function () {
                const settings = {
                    algorithms: {
                        templatesStore: {
                            enable: true,
                            cacheTTL: 30
                        },
                        queue: {
                            enable: false
                        },
                        store: {
                            enable: false
                        }
                    }
                }
                const adapterName = 'templatesStore';
                const adapterController = new AdapterController(config, settings);
                await adapterController.init();
                const adapter = adapterController._adapters.algorithms.templatesStore;
                const adapterKeys = Object.keys(adapterController._adapters.algorithms);
                const result = await adapter.getData();
                expect(adapter._cacheTTL).to.equal(30);
                expect(adapter._working).to.equal(false);
                expect(adapter.name).to.equal(adapterName);
                expect(adapter.mandatory).to.equal(false);
                expect(adapterKeys).to.have.lengthOf(1);
                expect(adapterKeys[0]).to.equal(adapterName);
                expect(result.data).to.be.an('object');
                expect(adapter._cache.data).to.be.an('object');
            });
        });
    });
    describe('Metrics-Flat', function () {
        describe('MetricsReducer', function () {
            it('should reduce the metrics results', async function () {
                const adapterController = new AdapterController(config, adapterSettings);
                await adapterController.init();
                const adaptersResults = await adapterController.getData();
                const metricsController = new MetricsController(configFlat, metricsSettings);
                await metricsController.init();
                const metricsResults = metricsController.run(adaptersResults);
                expect(metricsResults.algorithms).to.be.an('array');
                expect(metricsResults.drivers).to.be.an('array');
            });
        });
        describe('MetricsRunner', async function () {
            it('should calc the metrics weights', async function () {
                const metricsController = new MetricsController(configFlat, metricsSettings);
                await metricsController.init();
                const weight = metricsController._metrics.algorithms.map(a => a.weight).reduce((a, b) => a + b, 0);
                expect(weight).to.be.closeTo(1, 0.01);
            });
        });
        describe('AlgorithmQueue', function () {
            it('should calc metric and return results', async function () {
                const adapterController = new AdapterController(config, adapterSettings);
                await adapterController.init();
                const adaptersResults = await adapterController.getData();
                const metricsController = new MetricsController(config, metricsSettings);
                await metricsController.init();
                const metric = metricsController._metrics.algorithms.find(a => a.name === 'queue');
                const metricResults = metric.calc(adaptersResults);
                const res = new Set(metricResults.map(m => m.name));
                const ts = new Set(Object.keys(adaptersResults.algorithms.templatesStore));
                expect(metricResults).to.be.an('array');
                expect(res).to.deep.equal(ts);
            });
        });
        describe('CpuUsage', function () {
            it('should return weight same as config', async function () {
                const metricsController = new MetricsController(configFlat, metricsSettings);
                await metricsController.init();
                const metric = metricsController._metrics.algorithms.find(a => a.name === 'cpuUsage');
                expect(metric.weight).to.greaterThan(0);
            });
            it('should calc metric and return results', async function () {
                const adapterController = new AdapterController(config, adapterSettings);
                await adapterController.init();
                const adaptersResults = await adapterController.getData();
                const metricsController = new MetricsController(configFlat, metricsSettings);
                await metricsController.init();
                const metric = metricsController._metrics.algorithms.find(a => a.name === 'cpuUsage');
                const metricResults = metric.calc(adaptersResults);
                const res = new Set(metricResults.map(m => m.name));
                const ts = new Set(Object.keys(adaptersResults.algorithms.templatesStore));
                expect(metricResults).to.be.an('array');
                expect(res).to.deep.equal(ts);
            });
        });
        describe('RunTime', function () {
            it('should return weight same as config', async function () {
                const adapterController = new AdapterController(config, adapterSettings);
                await adapterController.init();
                const data = await adapterController.getData();
                const metricsController = new MetricsController(configFlat, metricsSettings);
                await metricsController.init();
                const metric = metricsController._metrics.algorithms.find(a => a.name === 'runTime');
                expect(metric.weight).to.greaterThan(0);
            });
            it('should calc metric and return results', async function () {
                const adapterController = new AdapterController(config, adapterSettings);
                await adapterController.init();
                const adaptersResults = await adapterController.getData();
                const metricsController = new MetricsController(configFlat, metricsSettings);
                await metricsController.init();
                const metric = metricsController._metrics.algorithms.find(a => a.name === 'runTime');
                const metricResults = metric.calc(adaptersResults);
                const res = new Set(metricResults.map(m => m.name));
                const ts = new Set(Object.keys(adaptersResults.algorithms.templatesStore));
                expect(metricResults).to.be.an('array');
                expect(res).to.deep.equal(ts);
            });
        });
        describe('TemplatesStore', function () {
            it('should return weight same as config', async function () {
                const adapterController = new AdapterController(config, adapterSettings);
                await adapterController.init();
                const data = await adapterController.getData();
                const metricsController = new MetricsController(configFlat, metricsSettings);
                await metricsController.init();
                const metric = metricsController._metrics.algorithms.find(a => a.name === 'templatesStore');
                expect(metric.weight).to.greaterThan(0);
            });
            it('should calc metric and return results', async function () {
                const adapterController = new AdapterController(config, adapterSettings);
                await adapterController.init();
                const adaptersResults = await adapterController.getData();
                const metricsController = new MetricsController(configFlat, metricsSettings);
                await metricsController.init();
                const metric = metricsController._metrics.algorithms.find(a => a.name === 'templatesStore');
                const metricResults = metric.calc(adaptersResults);
                const res = new Set(metricResults.map(m => m.name));
                const ts = new Set(Object.keys(adaptersResults.algorithms.templatesStore));
                expect(metricResults).to.be.an('array');
                expect(res).to.deep.equal(ts);
            });
        });
    });
    describe('Metrics-Map', function () {
        describe('MetricsReducer', function () {
            it('should reduce the metrics results', async function () {
                const adapterController = new AdapterController(config, adapterSettings);
                await adapterController.init();
                const adaptersResults = await adapterController.getData();
                const metricsController = new MetricsController(configMap, metricsSettings);
                await metricsController.init();
                const metricsResults = metricsController.run(adaptersResults);
                expect(metricsResults.algorithms).to.be.an('array');
                expect(metricsResults.drivers).to.be.an('array');
            });
        });
        describe('MetricsRunner', async function () {
            it('should calc the metrics weights', async function () {
                const metricsController = new MetricsController(configMap, metricsSettings);
                await metricsController.init();
                const weight = metricsController._metrics.algorithms.map(a => a.weight).reduce((a, b) => a + b, 0);
                expect(weight).to.be.closeTo(1, 0.01);
            });
        });
        describe('AlgorithmQueue', function () {
            it('should calc metric and return results', async function () {
                const adapterController = new AdapterController(config, adapterSettings);
                await adapterController.init();
                const adaptersResults = await adapterController.getData();
                const metricsController = new MetricsController(configMap, metricsSettings);
                await metricsController.init();
                const metric = metricsController._metrics.algorithms.find(a => a.name === 'queue');
                const metricResults = metric.calc(adaptersResults);
                const map = metricResults.map(m => m.name).sort();
                const algorithms = Object.keys(adaptersResults.algorithms.templatesStore).sort();
                expect(metricResults).to.be.an('array');
                expect(map).to.deep.equal(algorithms);
            });
        });
        describe('CpuUsage', function () {
            it('should return weight same as config', async function () {
                const metricsController = new MetricsController(configMap, metricsSettings);
                await metricsController.init();
                const metric = metricsController._metrics.algorithms.find(a => a.name === 'cpuUsage');
                expect(metric.weight).to.greaterThan(0);
            });
            it('should calc metric and return results', async function () {
                const adapterController = new AdapterController(config, adapterSettings);
                await adapterController.init();
                const adaptersResults = await adapterController.getData();
                const metricsController = new MetricsController(configMap, metricsSettings);
                await metricsController.init();
                const metric = metricsController._metrics.algorithms.find(a => a.name === 'cpuUsage');
                const metricResults = metric.calc(adaptersResults);
                const map = metricResults.map(m => m.name).sort();
                const algorithms = Object.keys(adaptersResults.algorithms.templatesStore).sort();
                expect(metricResults).to.be.an('array');
                expect(map).to.deep.equal(algorithms);
            });
        });
        describe('RunTime', function () {
            it('should return weight same as config', async function () {
                const adapterController = new AdapterController(config, adapterSettings);
                await adapterController.init();
                const data = await adapterController.getData();
                const metricsController = new MetricsController(configMap, metricsSettings);
                await metricsController.init();
                const metric = metricsController._metrics.algorithms.find(a => a.name === 'runTime');
                expect(metric.weight).to.greaterThan(0);
            });
            it('should calc metric and return results', async function () {
                const adapterController = new AdapterController(config, adapterSettings);
                await adapterController.init();
                const adaptersResults = await adapterController.getData();
                const metricsController = new MetricsController(configMap, metricsSettings);
                await metricsController.init();
                const metric = metricsController._metrics.algorithms.find(a => a.name === 'runTime');
                const metricResults = metric.calc(adaptersResults);
                const map = metricResults.map(m => m.name).sort();
                const algorithms = Object.keys(adaptersResults.algorithms.templatesStore).sort();
                expect(metricResults).to.be.an('array');
                expect(map).to.deep.equal(algorithms);
            });
        });
        describe('TemplatesStore', function () {
            it('should return weight same as config', async function () {
                const adapterController = new AdapterController(config, adapterSettings);
                await adapterController.init();
                const data = await adapterController.getData();
                const metricsController = new MetricsController(configMap, metricsSettings);
                await metricsController.init();
                const metric = metricsController._metrics.algorithms.find(a => a.name === 'templatesStore');
                expect(metric.weight).to.greaterThan(0);
            });
            it('should calc metric and return results', async function () {
                const adapterController = new AdapterController(config, adapterSettings);
                await adapterController.init();
                const adaptersResults = await adapterController.getData();
                const metricsController = new MetricsController(configMap, metricsSettings);
                await metricsController.init();
                const metric = metricsController._metrics.algorithms.find(a => a.name === 'templatesStore');
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
            const adapterController = new AdapterController(config, adapterSettings);
            await adapterController.init();
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
            const adapterController = new AdapterController(config, adapterSettings);
            await adapterController.init();
            const adaptersResults = await adapterController.getData();
            const resourceAllocator = new ResourceAllocator({ resourceThresholds: config.resourceThresholds.algorithms, resources: adaptersResults.resources.k8s, templatesStore: adaptersResults.algorithms.templatesStore });
            const algorithms = Object.keys(adaptersResults.algorithms.templatesStore).sort();
            algorithms.forEach((a) => resourceAllocator.allocate(a));
            const results = resourceAllocator.results();
            const keys = Object.keys(results).sort();
            const values = Object.values(results).sort();
            const array = Array(keys.length).fill(1, 0, keys.length)
            expect(keys).to.deep.equal(algorithms);
            expect(values).to.deep.equal(array);
        });
    });
    xdescribe('Monitoring', function () {
        it('should run the metricsProvider', function () {
            return new Promise(async function (resolve, reject) {
                const adapterController = new AdapterController(config, adapterSettings);
                await adapterController.init();
                const adaptersResults = await adapterController.getData();
                const metricsController = new MetricsController(config, metricsSettings);
                await metricsController.init();
                const metricsResults = metricsController.run(adaptersResults);
                metricsProvider.setPodsAllocations(metricsResults);
                resolve();

                // setTimeout(() => {
                //     resolve();
                // }, 20000)
            });

        });
    });
    describe('Interval-Flat', async function () {
        before(async function () {
            await intervalRunner.init(configFlat);
        })
        it('should execute doWork and return results', async function () {
            const result = await intervalRunner._doWork();
            expect(result.algorithms).to.be.an('array');
            expect(result.drivers).to.be.an('array');
        });
        it('should execute init and call _doWork once', async function () {
            const clock = sinon.useFakeTimers();
            const spy = sinon.spy(intervalRunner, '_doWork');
            await intervalRunner.init({ ...config, interval: 200 });
            clock.tick(1000);
            clock.restore();
            expect(spy.calledOnce).to.equal(true);
        });
    });
    describe('Interval-Map', async function () {
        before(async function () {
            await intervalRunner.init(configMap);
        })
        it('should execute doWork and return results', async function () {
            const result = await intervalRunner._doWork();
            expect(result.algorithms).to.be.an('array');
            expect(result.drivers).to.be.an('array');
        });
    });
});
