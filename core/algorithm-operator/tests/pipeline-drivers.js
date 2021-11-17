const { expect } = require('chai');
const clonedeep = require('lodash.clonedeep')
const { setPipelineDriverImage } = require('../lib/reconcile/createOptions');
const template = require('../lib/templates/pipeline-driver');
const CONTAINERS = require('../lib/consts/containers');
const { normalizeDrivers, normalizeDriversRequests, normalizeDriversJobs } = require('../lib/reconcile/normalize');
const { twoCompleted } = require('./stub/jobsRaw');
const drivers = require('./stub/drivers');
const { settings: globalSettings } = require('../lib/helpers/settings');
let options, callCount, clearCount, settings, normResources, driversReconciler, driverTemplates;
let applyPipelineDriverImage, createDriverJobSpec, applyNodeSelector, applyEnvToContainerFromSecretOrConfigMap;

describe('bootstrap', () => {
    before(async () => {
        ({ applyPipelineDriverImage, createDriverJobSpec, applyNodeSelector, applyEnvToContainerFromSecretOrConfigMap } = require('../lib/jobs/jobCreator'));
        options = global.testParams.config;
        callCount = global.testParams.kubernetes.callCount;
        clearCount = global.testParams.kubernetes.clearCount;
        const db = require('../lib/helpers/db');
        const operator = require('../lib/operator');
        driversReconciler = require('../lib/reconcile/drivers-reconciler');
        settings = operator._prepareDriversData(options);
        driverTemplates = await db.getDriversTemplate();
    });
    beforeEach(() => {
        clearCount();
    });
    describe('reconcile drivers tests', () => {
        it('should not create min amount of drivers with one request', async () => {
            const idle = drivers.filter(d => d.idle && !d.paused).length;
            const count = 0;
            const res = await driversReconciler.reconcileDrivers({
                options,
                drivers,
                normResources,
                settings,
                driverTemplates,
                driversRequests: [{
                    data: [
                        {
                            name: 'pipeline-driver'
                        }
                    ]
                }],
                jobs: {
                    body: {
                        items: [
                        ]
                    }
                }
            });
            expect(res).to.exist;
            expect(res).to.eql({ [settings.name]: { idle, required: count, paused: 0, pending: 0, created: count, skipped: 0 } });
        });
        it('should paused drivers', async () => {
            const idle = drivers.filter(d => d.idle && !d.paused).length;
            const minAmount = 5;
            const newSettings = {
                ...settings,
                minAmount
            };
            const res = await driversReconciler.reconcileDrivers({
                options,
                drivers,
                normResources,
                settings: newSettings,
                driverTemplates,
                driversRequests: [{
                    data: [
                        {
                            name: 'pipeline-driver'
                        }
                    ]
                }],
                jobs: {
                    body: {
                        items: [
                        ]
                    }
                }
            });
            expect(res).to.exist;
            expect(res).to.eql({ [settings.name]: { idle, required: 0, paused: 2, pending: 0, created: 0, skipped: 0 } });
        });
        it.skip('should create min amount of drivers not enough cpu', async () => {
            const idle = drivers.filter(d => d.idle && !d.paused).length;
            const { minAmount } = settings;
            const requiredPods = 30;
            const created = 0;
            const entry = Object.entries(driverTemplates)[0];
            const newTemplate = {
                ...entry[1],
                cpu: 10
            };
            const res = await driversReconciler.reconcileDrivers({
                options,
                drivers,
                normResources,
                settings,
                driverTemplates: {
                    [entry[0]]: newTemplate
                },
                driversRequests: [{
                    name: settings.name,
                    data: Array.from(Array(requiredPods).keys()).map(a => ({
                        name: 'pipeline-driver',
                    }))
                }],
                jobs: {
                    body: {
                        items: [
                        ]
                    }
                }
            });
            expect(res).to.exist;
            expect(res).to.eql({ [settings.name]: { idle, required: minAmount, paused: 0, pending: 0, created, skipped: minAmount } });
        });
        it.skip('should create min amount of drivers not enough memory', async () => {
            const idle = drivers.filter(d => d.idle && !d.paused).length;
            const { minAmount } = settings
            const required = 30;
            const created = 0;
            const entry = Object.entries(driverTemplates)[0];
            const newTemplate = {
                ...entry[1],
                mem: 48000
            };

            const res = await driversReconciler.reconcileDrivers({
                options,
                drivers,
                normResources,
                settings,
                driverTemplates: {
                    [entry[0]]: newTemplate
                },
                driversRequests: [{
                    name: settings.name,
                    data: Array.from(Array(required).keys()).map(a => ({
                        name: 'pipeline-driver',
                    }))
                }],
                jobs: {
                    body: {
                        items: [
                        ]
                    }
                }
            });
            expect(res).to.exist;
            expect(res).to.eql({ [settings.name]: { idle, required: minAmount, paused: 0, pending: 0, created, skipped: minAmount } });
        });
        it('should only create 30 in one iteration - drivers', async () => {
            const idle = drivers.filter(d => d.idle && !d.paused).length;
            const { minAmount } = settings
            const res = await driversReconciler.reconcileDrivers({
                options,
                drivers: [],
                normResources,
                settings,
                driverTemplates,
                driversRequests: [{
                    name: settings.name,
                    data: Array.from(Array(40).keys()).map(a => ({
                        name: 'pipeline-driver',
                    }))
                }],
                jobs: {
                    body: {
                        items: [

                        ]
                    }
                }
            });
            expect(res).to.exist;
            expect(res).to.eql({ [settings.name]: { idle: 0, required: minAmount, paused: 0, pending: 0, created: minAmount, skipped: 0 } });
            expect(callCount('createJob').length).to.eql(minAmount);
        });
        it('should scale to max amount of drivers', async () => {
            const idle = drivers.filter(d => d.idle && !d.paused).length;
            const { minAmount, maxAmount } = settings;
            const requiredPods = minAmount * 100;

            const res = await driversReconciler.reconcileDrivers({
                options,
                drivers,
                normResources,
                settings,
                driverTemplates,
                driversRequests: [{
                    name: settings.name,
                    data: Array.from(Array(requiredPods).keys()).map(a => ({
                        name: 'pipeline-driver',
                    }))
                }],
                jobs: {
                    body: {
                        items: [
                        ]
                    }
                }
            });

            expect(res).to.exist;
            expect(res).to.eql({ [settings.name]: { idle, required: maxAmount, paused: 0, pending: 0, created: maxAmount, skipped: 0 } });
            expect(callCount('createJob').length).to.eql(maxAmount);
        });
    });
    describe('PipelineDriverJobCreator', () => {
        describe('applyImageName', () => {
            it('should replace algorithm image name in spec', () => {
                const res = applyPipelineDriverImage(template, 'registry:5000/pipeline-driver:v2');
                expect(res).to.nested.include({ 'spec.template.spec.containers[0].image': 'registry:5000/pipeline-driver:v2' });
            });
            it('should throw if no container', () => {
                const missingAlgorunnerSpec = clonedeep(template);
                missingAlgorunnerSpec.spec.template.spec.containers.splice(0, 1);
                expect(() => applyPipelineDriverImage(missingAlgorunnerSpec, 'registry:5000/myAlgo1Image:v2')).to.throw('unable to find container pipeline-driver');
            });
        });
        describe('setPipelineDriverImage', () => {
            it('should use image from versions config map', () => {
                const versions = {
                    versions: [
                        {
                            project: 'pipeline-driver',
                            tag: 'v1.2.3',
                            image: 'foo/pd'
                        }
                    ]
                }
                driverTemplate = {
                    "name": "pipeline-driver",
                    "image": "hkube/pipeline-driver",
                    "cpu": 0.1,
                    "mem": 128
                };
                const res = setPipelineDriverImage(driverTemplate, versions);
                expect(res).to.eql('foo/pd:v1.2.3')
            })
            it('should use image from template', () => {
                const versions = {
                    versions: [
                        {
                            project: 'pipeline-driver',
                            tag: 'v1.2.3'
                        }
                    ]
                }
                driverTemplate = {
                    "name": "pipeline-driver",
                    "image": "hkube/pipeline-driver",
                    "cpu": 0.1,
                    "mem": 128
                };
                const res = setPipelineDriverImage(driverTemplate, versions);
                expect(res).to.eql('hkube/pipeline-driver:v1.2.3')
            })
            it('should use image from versions config map with registry', () => {
                const versions = {
                    versions: [
                        {
                            project: 'pipeline-driver',
                            tag: 'v1.2.3',
                            image: 'foo/pd'
                        }
                    ]
                }
                const registry = 'localhost:5555/bar'
                driverTemplate = {
                    "name": "pipeline-driver",
                    "image": "hkube/pipeline-driver",
                    "cpu": 0.1,
                    "mem": 128
                };
                const res = setPipelineDriverImage(driverTemplate, versions, { registry });
                expect(res).to.eql('localhost:5555/bar/foo/pd:v1.2.3')
            })
        })
        xdescribe('useNodeSelector', () => {
            it('should remove node selector in spec', () => {
                const res = applyNodeSelector(template, null, { useNodeSelector: false });
                expect(res.spec.template.spec.nodeSelector).to.be.undefined;
            });
            it('should remove node selector in spec 2', () => {
                const res = applyNodeSelector(template);
                expect(res.spec.template.spec.nodeSelector).to.be.undefined;
            });
            it('should not remove node selector in spec', () => {
                const res = applyNodeSelector(template, null, { useNodeSelector: true });
                expect(res.spec.template.spec.nodeSelector).to.exist;
            });
        });
        describe('applyEnvToContainerFromSecretOrConfigMap', () => {
            it('should add env to spec', () => {
                const envLength = template.spec.template.spec.containers[0].env.length;
                const test = { xxx: { obj: 'test' } };
                const res = applyEnvToContainerFromSecretOrConfigMap(template, CONTAINERS.PIPELINE_DRIVER, test);
                expect(res.spec.template.spec.containers[0].env).to.have.lengthOf(envLength + 1);
                expect(res.spec.template.spec.containers[0].env).to.deep.include({
                    name: 'xxx', valueFrom: { obj: 'test' }
                });
            });
            it('should replace env in spec', () => {
                const test = { xxx: { obj: 'test' } };
                const testNew = { xxx: { obj: 'testnew' } };
                const res = applyEnvToContainerFromSecretOrConfigMap(template, CONTAINERS.PIPELINE_DRIVER, test);
                const envLength = res.spec.template.spec.containers[0].env.length;
                const resNew = applyEnvToContainerFromSecretOrConfigMap(res, CONTAINERS.PIPELINE_DRIVER, testNew);
                expect(resNew.spec.template.spec.containers[0].env).to.have.lengthOf(envLength);
                expect(resNew.spec.template.spec.containers[0].env).to.deep.include({ name: 'xxx', valueFrom: { obj: 'testnew' } });
            });
            it('should remove env in spec', () => {
                const test = { xxx: 'test' };
                const res1 = applyEnvToContainerFromSecretOrConfigMap(template, CONTAINERS.PIPELINE_DRIVER, test);
                const envLength = res1.spec.template.spec.containers[0].env.length;
                const testNull = { xxx: null };
                const res = applyEnvToContainerFromSecretOrConfigMap(res1, CONTAINERS.PIPELINE_DRIVER, testNull);
                expect(res.spec.template.spec.containers[0].env).to.have.lengthOf(envLength - 1);
                expect(res.spec.template.spec.containers[0].env).to.not.deep.include({ name: 'xxx', value: 'test' });
            });
            it('should add multiple env to spec', () => {
                const envLength = template.spec.template.spec.containers[0].env.length;
                const res = applyEnvToContainerFromSecretOrConfigMap(template, CONTAINERS.PIPELINE_DRIVER, {
                    xxx: '111',
                    yyy: '222'
                });
                expect(res.spec.template.spec.containers[0].env).to.have.lengthOf(envLength + 2);
            });
            it('combine', () => {
                const test = { xxx: 'test' };
                const res1 = applyEnvToContainerFromSecretOrConfigMap(template, CONTAINERS.PIPELINE_DRIVER, test);
                const envLength = res1.spec.template.spec.containers[0].env.length;
                const res = applyEnvToContainerFromSecretOrConfigMap(res1, CONTAINERS.PIPELINE_DRIVER, {
                    xxx: '111',
                    yyy: '222'
                });
                expect(res.spec.template.spec.containers[0].env).to.have.lengthOf(envLength + 1);
            });
        });
        describe('createDriverJobSpec', () => {
            beforeEach(() => {
                globalSettings.applyResources = false;
            });
            it('should throw if no image name', () => {
                expect(() => createDriverJobSpec({ options })).to.throw('Unable to create job spec. image is required');
            });
            it('should apply all required properties', () => {
                const res = createDriverJobSpec({ ...{ options }, image: 'myImage1' });
                expect(res).to.nested.include({ 'spec.template.spec.containers[0].image': 'myImage1' });
                expect(res.metadata.name).to.include(CONTAINERS.PIPELINE_DRIVER);
            });
            it('should apply with worker', () => {
                const res = createDriverJobSpec({ ...{ options }, image: 'myImage1' });
                expect(res).to.nested.include({ 'spec.template.spec.containers[0].image': 'myImage1' });
                expect(res.metadata.name).to.include(CONTAINERS.PIPELINE_DRIVER);
            });
            it('should apply resources', () => {
                globalSettings.applyResources = true;
                const res = createDriverJobSpec({
                    ...{ options },
                    image: 'myImage1',
                    resourceRequests: { requests: { cpu: '200m' }, limits: { cpu: '500m', memory: '200M' } }
                });
                expect(res).to.nested.include({ 'spec.template.spec.containers[0].image': 'myImage1' });
                expect(res.metadata.name).to.include(CONTAINERS.PIPELINE_DRIVER);
                expect(res.spec.template.spec.containers[0].resources).to.deep.include({ requests: { cpu: '200m' } });
                expect(res.spec.template.spec.containers[0].resources).to.deep.include({ limits: { cpu: '500m', memory: '200M' } });
                expect(res.spec.template.spec.containers[0].env).to.deep.include({
                    name: 'DEFAULT_STORAGE',
                    valueFrom: {
                        configMapKeyRef: {
                            key: 'DEFAULT_STORAGE',
                            name: 'algorithm-operator-configmap'
                        }
                    }
                });
                expect(res.spec.template.spec.containers[0].env).to.deep.include({
                    name: 'STORAGE_ENCODING',
                    valueFrom: {
                        configMapKeyRef: {
                            key: 'STORAGE_ENCODING',
                            name: 'algorithm-operator-configmap'
                        }
                    }
                });
            });
            it('should not apply resources', () => {
                const res = createDriverJobSpec({
                    ...{ options },
                    image: 'myImage1',
                    resourceRequests: { requests: { cpu: '200m' }, limits: { cpu: '500m', memory: '200M' } }
                });
                expect(res).to.nested.include({ 'spec.template.spec.containers[0].image': 'myImage1' });
                expect(res.metadata.name).to.include(CONTAINERS.PIPELINE_DRIVER);
                expect(res.spec.template.spec.containers[0].resources).to.not.exist;
            });
            it('should apply jaeger with privileged mode', () => {
                const res = createDriverJobSpec({
                    ...{ options: { ...options, kubernetes: { isPrivileged: true } } },
                    image: 'myImage1',
                    resourceRequests: { requests: { cpu: '200m' }, limits: { cpu: '500m', memory: '200M' } }
                });
                expect(res.spec.template.spec.containers[0].env.find(e => e.name === 'JAEGER_AGENT_SERVICE_HOST')).to.have.property('valueFrom')
            });
            it('should apply jaeger without privileged mode', () => {
                const res = createDriverJobSpec({
                    ...{ options: { ...options, kubernetes: { isPrivileged: false } } },
                    image: 'myImage1',
                    resourceRequests: { requests: { cpu: '200m' }, limits: { cpu: '500m', memory: '200M' } }
                });
                expect(res.spec.template.spec.containers[0].env.find(e => e.name === 'JAEGER_AGENT_SERVICE_HOST')).to.be.undefined;
            });
            it('should apply jaeger without privileged mode with external host', () => {
                const res = createDriverJobSpec({
                    ...{ options: { ...options, kubernetes: { isPrivileged: false }, jaeger: { host: 'foo.bar' } } },
                    image: 'myImage1',
                    resourceRequests: { requests: { cpu: '200m' }, limits: { cpu: '500m', memory: '200M' } }
                });
                expect(res.spec.template.spec.containers[0].env.find(e => e.name === 'JAEGER_AGENT_SERVICE_HOST').value).to.eql('foo.bar');
            });
            it('should apply imagePullSecrets', () => {
                const res = createDriverJobSpec({ ...{ options }, image: 'myImage1', clusterOptions: { imagePullSecretName: 'my-secret' } });
                expect(res.spec.template.spec.imagePullSecrets).to.exist;
                expect(res.spec.template.spec.imagePullSecrets[0]).to.eql({ name: 'my-secret' });
            });
        });
    });
    describe('normalize pipeline driver', () => {
        describe('normalize jobs', () => {
            it('should work with no jobs', () => {
                const jobsRaw = {};
                const res = normalizeDriversJobs(jobsRaw);
                expect(res).to.be.empty;
            });
            it('should work with undefined', () => {
                const res = normalizeDriversJobs();
                expect(res).to.be.empty;
            });
            it('should ignore completed jobs', () => {
                const res = normalizeDriversJobs(twoCompleted, j => !j.status.succeeded);
                expect(res).to.have.lengthOf(2);
            });
            it('should ignore active jobs', () => {
                const res = normalizeDriversJobs(twoCompleted, j => j.status.succeeded);
                expect(res).to.have.lengthOf(2);
            });
            it('should ignore completed and failed jobs', () => {
                const res = normalizeDriversJobs(twoCompleted, j => (!j.status.succeeded && !j.status.failed));
                expect(res).to.have.lengthOf(1);
            });
            it('should return all jobs', () => {
                const res = normalizeDriversJobs(twoCompleted);
                expect(res).to.have.lengthOf(4);
            });
        });
        describe('normalize drivers', () => {
            it('should work with empty drivers array', () => {
                const drivers = [];
                const res = normalizeDrivers(drivers);
                expect(res).to.be.empty;
            });
            it('should work with undefined drivers array', () => {
                const res = normalizeDrivers();
                expect(res).to.be.empty;
            });
            it('should return object with ids', () => {
                const drivers = [
                    {
                        driverId: 'id1',
                    },
                    {
                        driverId: 'id2',
                    },
                    {
                        driverId: 'id3',
                    }
                ];
                const res = normalizeDrivers(drivers);
                expect(res).to.have.length(3);
                expect(res).to.deep.include({
                    id: 'id1',
                    idle: undefined,
                    paused: undefined,
                    podName: undefined,
                    jobs: 0
                });
                expect(res).to.deep.include({
                    id: 'id2',
                    idle: undefined,
                    paused: undefined,
                    podName: undefined,
                    jobs: 0
                });
                expect(res).to.deep.include({
                    id: 'id3',
                    idle: undefined,
                    paused: undefined,
                    podName: undefined,
                    jobs: 0
                });
            });
        });
        describe('normalize requests', () => {
            it('should work with empty requests array', () => {
                const res = normalizeDriversRequests([]);
                expect(res).to.eql(0);
            });
            it('should work with undefined requests array', () => {
                const res = normalizeDriversRequests();
                expect(res).to.eql(0);
            });
            it('should return object with requests per algorithms', () => {
                const name = 'pipeline-driver';
                const stub = [
                    {
                        data: [
                            {
                                name,
                            },
                            {
                                name,
                            },
                            {
                                name,
                            }

                        ]
                    }
                ];
                const res = normalizeDriversRequests(stub, name);
                expect(res).to.eql(3);
            });
        });
    });
});
