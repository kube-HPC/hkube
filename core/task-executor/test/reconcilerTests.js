const { expect } = require('chai');
const mockery = require('mockery');
const configIt = require('@hkube/config');
const Logger = require('@hkube/logger');
const { main, logger } = configIt.load();
const log = new Logger(main.serviceName, logger);
const { callCount, mock, clearCount } = (require('./mocks/kubernetes.mock')).kubernetes()
const etcd = require('../lib/helpers/etcd');
const { normalizeResources } = require('../lib/reconcile/normalize');
const templateStore = require('./stub/templateStore');
const driversTemplateStore = require('./stub/driversTemplateStore');
const utils = require('../lib/utils/utils');
const resources = require('./stub/resources');
const normResources = normalizeResources(resources);
const config = main;
let reconciler, algorithmTemplates, driverTemplates;

const prepareDriversData = (options) => {
    const { minAmount, scalePercent, name } = options.driversSetting;
    const maxAmount = (minAmount * scalePercent) + minAmount;
    return { minAmount, maxAmount, name };
}
const settings = prepareDriversData(config);

describe('reconciler', () => {
    before(async () => {
        mockery.enable({
            warnOnReplace: false,
            warnOnUnregistered: false,
            useCleanCache: false
        });
        mockery.registerMock('../helpers/kubernetes', mock);
        reconciler = require('../lib/reconcile/reconciler');

        await etcd.init(main);
        await Promise.all(templateStore.map(d => etcd._etcd.algorithms.templatesStore.set({ name: d.name, data: d })));
        await Promise.all(driversTemplateStore.map(d => etcd._etcd.pipelineDrivers.templatesStore.set({ name: d.name, data: d })));

        const algTemplates = await etcd.getAlgorithmTemplate();
        algorithmTemplates = utils.arrayToMap(algTemplates);

        const driTemplates = await etcd.getDriversTemplate();
        driverTemplates = utils.arrayToMap(driTemplates);
    });
    after(() => {
        mockery.disable();
    });
    beforeEach(() => {
        clearCount();
    });
    describe('reconcile algorithms tests', () => {
        it('should work with no params', async () => {
            const res = await reconciler.reconcile({ normResources });
            expect(res).to.exist
            expect(res).to.be.empty
            expect(callCount('createJob')).to.be.undefined
        })
        it('should work with one algo', async () => {
            const res = await reconciler.reconcile({
                normResources,
                algorithmTemplates,
                algorithmRequests: [{
                    name: 'green-alg',
                    data: {
                        pods: 1
                    }
                }],
                jobs: {
                    body: {
                        items: [

                        ]
                    }
                }
            });
            expect(res).to.exist;
            expect(res).to.eql({ 'green-alg': { idle: 0, required: 1, paused: 0, pending: 0, created: 1, skipped: 0 } });
            expect(callCount('createJob').length).to.eql(1);
            expect(callCount('createJob')[0][0].spec.spec.template.spec.containers[0].image).to.eql('hkube/worker');
            expect(callCount('createJob')[0][0].spec.spec.template.spec.containers[1].image).to.eql('hkube/algorithm-example');
        });
        it('should work with algorithm with not enough cpu', async () => {
            algorithmTemplates['hungry-alg'] = {
                name: 'hungry-alg',
                algorithmImage: 'hkube/algorithm-example',
                cpu: 8,
                mem: 100
            };
            const res = await reconciler.reconcile({
                normResources,
                algorithmTemplates,
                algorithmRequests: [{
                    name: 'hungry-alg',
                    data: {
                        pods: 4
                    }
                }],
                jobs: {
                    body: {
                        items: [

                        ]
                    }
                }
            });
            expect(res).to.exist;
            expect(res).to.eql({ 'hungry-alg': { idle: 0, required: 4, paused: 0, pending: 0, created: 2, skipped: 2 } });
            expect(callCount('createJob').length).to.eql(2);
        });
        it('should only create 30 in one iteration', async () => {
            algorithmTemplates['hungry-alg'] = {
                name: 'hungry-alg',
                algorithmImage: 'hkube/algorithm-example',
                cpu: 0.1,
                mem: 100
            };
            const res = await reconciler.reconcile({
                normResources,
                algorithmTemplates,
                algorithmRequests: [{
                    name: 'hungry-alg',
                    data: {
                        pods: 40
                    }
                }],
                jobs: {
                    body: {
                        items: [

                        ]
                    }
                }
            });
            expect(res).to.exist;
            expect(res).to.eql({ 'hungry-alg': { idle: 0, required: 40, paused: 0, pending: 0, created: 30, skipped: 10 } });
            expect(callCount('createJob').length).to.eql(30);
        });
        it('should work with algorithm with enough resources', async () => {
            algorithmTemplates['hungry-alg'] = {
                name: 'hungry-alg',
                algorithmImage: 'hkube/algorithm-example',
                cpu: 4,
                mem: 100
            };
            const res = await reconciler.reconcile({
                normResources,
                algorithmTemplates,
                algorithmRequests: [{
                    name: 'hungry-alg',
                    data: {
                        pods: 4
                    }
                }],
                jobs: {
                    body: {
                        items: [

                        ]
                    }
                }
            });
            expect(res).to.exist;
            expect(res).to.eql({ 'hungry-alg': { idle: 0, required: 4, paused: 0, pending: 0, created: 4, skipped: 0 } });
            expect(callCount('createJob').length).to.eql(4);
        });
        it('should work with algorithm with not enough memory', async () => {
            algorithmTemplates['hungry-alg'] = {
                name: 'hungry-alg',
                algorithmImage: 'hkube/algorithm-example',
                cpu: 4,
                mem: 40000
            };
            const res = await reconciler.reconcile({
                normResources,
                algorithmTemplates,
                algorithmRequests: [{
                    name: 'hungry-alg',
                    data: {
                        pods: 4
                    }
                }],
                jobs: {
                    body: {
                        items: [

                        ]
                    }
                }
            });
            expect(res).to.exist;
            expect(res).to.eql({ 'hungry-alg': { idle: 0, required: 4, paused: 0, pending: 0, created: 2, skipped: 2 } });
            expect(callCount('createJob').length).to.eql(2);
        });
        it('should work with custom worker', async () => {
            algorithmTemplates['green-alg'] = {
                algorithmImage: 'hkube/algorithm-example',
                workerImage: 'myregistry:5000/stam/myworker:v2',
                cpu: 4,
                mem: 40000
            };
            const res = await reconciler.reconcile({
                normResources,
                algorithmTemplates,
                algorithmRequests: [{
                    name: 'green-alg',
                    data: {
                        pods: 1
                    }
                }],
                jobs: {
                    body: {
                        items: [

                        ]
                    }
                }
            });
            expect(res).to.exist;
            expect(res).to.eql({ 'green-alg': { idle: 0, required: 1, paused: 0, pending: 0, created: 1, skipped: 0 } });
            expect(callCount('createJob').length).to.eql(1);
            expect(callCount('createJob')[0][0].spec.spec.template.spec.containers[0].image).to.eql('myregistry:5000/stam/myworker:v2');
            expect(callCount('createJob')[0][0].spec.spec.template.spec.containers[1].image).to.eql('hkube/algorithm-example');
        });
        it('should work with env', async () => {
            algorithmTemplates['green-alg'] = {
                algorithmImage: 'hkube/algorithm-example',
                workerEnv: {
                    myEnv: 'myValue'
                },
                algorithmEnv: {
                    myAlgoEnv: 'myAlgoValue'
                }
            };
            const res = await reconciler.reconcile({
                normResources,
                algorithmTemplates,
                algorithmRequests: [{
                    name: 'green-alg',
                    data: {
                        pods: 1
                    }
                }],
                jobs: {
                    body: {
                        items: [

                        ]
                    }
                }
            });
            expect(res).to.exist;
            expect(res).to.eql({ 'green-alg': { idle: 0, required: 1, paused: 0, pending: 0, created: 1, skipped: 0 } });
            expect(callCount('createJob').length).to.eql(1);
            expect(callCount('createJob')[0][0].spec.spec.template.spec.containers[0].image).to.eql('hkube/worker');
            expect(callCount('createJob')[0][0].spec.spec.template.spec.containers[0].env).to.deep.include({ name: 'myEnv', value: 'myValue' });
            expect(callCount('createJob')[0][0].spec.spec.template.spec.containers[1].env).to.deep.include({ name: 'myAlgoEnv', value: 'myAlgoValue' });
            expect(callCount('createJob')[0][0].spec.spec.template.spec.containers[1].image).to.eql('hkube/algorithm-example');
        });
    });
    describe('reconcile drivers tests', () => {
        it('should create min amount of drivers with one request', async () => {
            const count = config.driversSetting.minAmount;
            const res = await reconciler.reconcileDrivers({
                normResources,
                settings,
                driverTemplates,
                driversRequests: [{
                    name: settings.name,
                    data: {
                        pods: 1
                    }
                }],
                jobs: {
                    body: {
                        items: [
                        ]
                    }
                }
            });
            expect(res).to.exist;
            expect(res).to.eql({ [settings.name]: { idle: 0, required: count, paused: 0, pending: 0, created: count, skipped: 0 } });
            expect(callCount('createJob').length).to.eql(count);
            expect(callCount('createJob')[0][0].spec.spec.template.spec.containers[0].name).to.eql(settings.name);
            expect(callCount('createJob')[0][0].spec.spec.template.spec.containers[0].image).to.eql('hkube/pipeline-driver');
        });
        it('should create min amount of drivers not enough cpu', async () => {
            const { maxAmount } = settings
            const requiredPods = 30;
            const created = 2;
            const entry = Object.entries(driverTemplates)[0];
            const newTemplate = {
                ...entry[1],
                cpu: 8,
                mem: 500
            };
            const res = await reconciler.reconcileDrivers({
                normResources,
                settings,
                driverTemplates: {
                    [entry[0]]: newTemplate
                },
                driversRequests: [{
                    name: settings.name,
                    data: {
                        pods: requiredPods
                    }
                }],
                jobs: {
                    body: {
                        items: [
                        ]
                    }
                }
            });
            expect(res).to.exist;
            expect(res).to.eql({ [settings.name]: { idle: 0, required: maxAmount, paused: 0, pending: 0, created, skipped: maxAmount - created } });
            expect(callCount('createJob').length).to.eql(created);
        });
        it('should create min amount of drivers not enough memory', async () => {
            const { maxAmount } = settings
            const required = 30;
            const created = 3;
            const entry = Object.entries(driverTemplates)[0];
            const newTemplate = {
                ...entry[1],
                cpu: 0.1,
                mem: 28000
            };

            const res = await reconciler.reconcileDrivers({
                normResources,
                settings,
                driverTemplates: {
                    [entry[0]]: newTemplate
                },
                driversRequests: [{
                    name: settings.name,
                    data: {
                        pods: required
                    }
                }],
                jobs: {
                    body: {
                        items: [
                        ]
                    }
                }
            });
            expect(res).to.exist;
            expect(res).to.eql({ [settings.name]: { idle: 0, required: maxAmount, paused: 0, pending: 0, created, skipped: maxAmount - created } });
            expect(callCount('createJob').length).to.eql(created);
        });
        it('should only create 30 in one iteration - drivers', async () => {
            const { maxAmount } = settings
            const res = await reconciler.reconcileDrivers({
                normResources,
                settings,
                driverTemplates,
                driversRequests: [{
                    name: settings.name,
                    data: {
                        pods: 40
                    }
                }],
                jobs: {
                    body: {
                        items: [

                        ]
                    }
                }
            });
            expect(res).to.exist;
            expect(res).to.eql({ [settings.name]: { idle: 0, required: maxAmount, paused: 0, pending: 0, created: maxAmount, skipped: 0 } });
            expect(callCount('createJob').length).to.eql(maxAmount);
        });
        it('should scale to max amount of drivers', async () => {
            const { minAmount, scalePercent } = config.driversSetting;
            const required = minAmount;
            const requiredPods = required * 100;
            const scale = (minAmount * scalePercent) + minAmount;

            const res = await reconciler.reconcileDrivers({
                normResources,
                settings,
                driverTemplates,
                driversRequests: [{
                    name: settings.name,
                    data: {
                        pods: requiredPods
                    }
                }],
                jobs: {
                    body: {
                        items: [
                        ]
                    }
                }
            });

            expect(res).to.exist;
            expect(res).to.eql({ [settings.name]: { idle: 0, required: scale, paused: 0, pending: 0, created: scale, skipped: 0 } });
            expect(callCount('createJob').length).to.eql(scale);
        });
    });
});
