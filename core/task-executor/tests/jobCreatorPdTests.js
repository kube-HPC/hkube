const clonedeep = require('lodash.clonedeep');
const configIt = require('@hkube/config');
const Logger = require('@hkube/logger');
const { main, logger } = configIt.load();
const options = main;
const log = new Logger(main.serviceName, logger);
const { expect } = require('chai');
const { applyPipelineDriverImage, createDriverJobSpec, applyNodeSelector,
    applyEnvToContainerFromSecretOrConfigMap } = require('../lib/jobs/jobCreator');
const { setPipelineDriverImage } = require('../lib/reconcile/createOptions');
const template = require('../lib/templates').pipelineDriverTemplate;
const CONTAINERS = require('../lib/consts/containers');
const { settings: globalSettings } = require('../lib/helpers/settings');

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
                        name: 'task-executor-configmap'
                    }
                }
            });
            expect(res.spec.template.spec.containers[0].env).to.deep.include({
                name: 'STORAGE_ENCODING',
                valueFrom: {
                    configMapKeyRef: {
                        key: 'STORAGE_ENCODING',
                        name: 'task-executor-configmap'
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
