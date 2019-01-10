const clonedeep = require('lodash.clonedeep');
const configIt = require('@hkube/config');
const Logger = require('@hkube/logger');
const { main, logger } = configIt.load();
const options = main;
const log = new Logger(main.serviceName, logger);
const { expect } = require('chai');
const { applyPipelineDriverImage, createDriverJobSpec, applyEnvToContainer, applyNodeSelector,
    applyEnvToContainerFromSecretOrConfigMap, applyVolumes, applyVolumeMounts } = require('../lib/jobs/jobCreator');
const template = require('../lib/templates').pipelineDriverTemplate;
const templateWorker = require('../lib/templates').workerTemplate;
const CONTAINERS = require('../lib/consts/containers');

describe('PipelineDriverJobCreator', () => {
    describe('applyImageName', () => {
        it('should replace algorithm image name in spec', () => {
            const res = applyPipelineDriverImage(template, 'registry:5000/pipeline-driver:v2');
            expect(res).to.nested.include({ 'spec.template.spec.containers[0].image': 'registry:5000/pipeline-driver:v2' });
        });
        it('should throw if no container', () => {
            const missingAlgorunnerSpec = clonedeep(template);
            missingAlgorunnerSpec.spec.template.spec.containers.splice(0, 1);
            expect(() => applyPipelineDriverImage(missingAlgorunnerSpec, 'registry:5000/myAlgo1Image:v2')).to.throw('Unable to create job spec. pipeline-driver container not found');
        });
    });
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
    describe('applyEnvToContainer', () => {
        it('should add env to spec', () => {
            const envLength = template.spec.template.spec.containers[0].env.length;
            const res = applyEnvToContainer(template, CONTAINERS.PIPELINE_DRIVER, { env1: 'value1' });
            expect(res.spec.template.spec.containers[0].env).to.have.lengthOf(envLength + 1);
            expect(res.spec.template.spec.containers[0].env).to.deep.include({ name: 'env1', value: 'value1' });
        });
        it('should replace env in spec', () => {
            const envLength = template.spec.template.spec.containers[0].env.length;
            const res = applyEnvToContainer(template, CONTAINERS.PIPELINE_DRIVER, { NODE_ENV: 'newEnv' });
            expect(res.spec.template.spec.containers[0].env).to.have.lengthOf(envLength);
            expect(res.spec.template.spec.containers[0].env).to.deep.include({ name: 'NODE_ENV', value: 'newEnv' });
        });
        it('should remove env in spec', () => {
            const envLength = template.spec.template.spec.containers[0].env.length;
            const res = applyEnvToContainer(template, CONTAINERS.PIPELINE_DRIVER, { NODE_ENV: null });
            expect(res.spec.template.spec.containers[0].env).to.have.lengthOf(envLength - 1);
            expect(res.spec.template.spec.containers[0].env).to.not.deep.include({ name: 'NODE_ENV', value: 'kube' });
        });
        it('combine', () => {
            const envLength = template.spec.template.spec.containers[0].env.length;
            const res = applyEnvToContainer(template, CONTAINERS.PIPELINE_DRIVER, { NODE_ENV: null, OTHER_ENV: 'new', newEnv: 3 });
            expect(res.spec.template.spec.containers[0].env).to.have.lengthOf(envLength + 1);
            expect(res.spec.template.spec.containers[0].env).to.not.deep.include({ name: 'NODE_ENV', value: 'kube' });
            expect(res.spec.template.spec.containers[0].env).to.deep.include({ name: 'OTHER_ENV', value: 'new' });
        });
    });

    describe('applyEnvToContainerFromSecretOrConfigMap', () => {
        it('should add env to spec', () => {
            const envLength = template.spec.template.spec.containers[0].env.length;
            const test = { xxx: 'test' };
            const res = applyEnvToContainerFromSecretOrConfigMap(template, CONTAINERS.PIPELINE_DRIVER, test);
            expect(res.spec.template.spec.containers[0].env).to.have.lengthOf(envLength + 1);
            expect(res.spec.template.spec.containers[0].env).to.deep.include({
                name: 'xxx', valueFrom: 'test'
            });
        });
        it('should replace env in spec', () => {
            const test = { xxx: 'test' };
            const testNew = { xxx: 'testnew' };
            const res = applyEnvToContainerFromSecretOrConfigMap(template, CONTAINERS.PIPELINE_DRIVER, test);
            const envLength = res.spec.template.spec.containers[0].env.length;
            const resNew = applyEnvToContainerFromSecretOrConfigMap(res, CONTAINERS.PIPELINE_DRIVER, testNew);
            expect(resNew.spec.template.spec.containers[0].env).to.have.lengthOf(envLength);
            expect(resNew.spec.template.spec.containers[0].env).to.deep.include({ name: 'xxx', valueFrom: 'testnew' });
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

    describe('applyVolumes', () => {
        it('should add volume to spec', () => {
            const envLength = templateWorker.spec.template.spec.volumes.length;
            const newVolume = { name: 'storage-volume', persistentVolumeClaim: { claimName: 'hkube-storage-pvc' } };
            const res = applyVolumes(templateWorker, newVolume);
            expect(res.spec.template.spec.volumes).to.have.lengthOf(envLength + 1);
            expect(res.spec.template.spec.volumes).to.deep.include(newVolume);
        });
        it('should replace volume in spec', () => {
            const volume = { name: 'storage-volume', persistentVolumeClaim: { claimName: 'hkube-storage-pvc1' } };
            const newVolume = { name: 'storage-volume', persistentVolumeClaim: { claimName: 'hkube-storage-pvc2' } };
            const res = applyVolumes(template, volume);
            const envLength = res.spec.template.spec.volumes.length;
            const resNew = applyVolumes(res, newVolume);
            expect(resNew.spec.template.spec.volumes).to.have.lengthOf(envLength);
            expect(resNew.spec.template.spec.volumes).to.deep.include(newVolume);
            expect(resNew.spec.template.spec.volumes).to.not.deep.include(volume);
        });
        it('combine', () => {
            const volume = { name: 'storage-volume', persistentVolumeClaim: { claimName: 'hkube-storage-pvc1' } };
            const updateVolume = { name: 'storage-volume', persistentVolumeClaim: { claimName: 'hkube-storage-pvc2' } };
            const newVolume = { name: 'test', persistentVolumeClaim: { claimName: 'hkube-storage-pvc3' } };
            const res = applyVolumes(template, volume);
            const updateRes = applyVolumes(res, updateVolume);
            const resNew = applyVolumes(updateRes, newVolume);
            expect(resNew.spec.template.spec.volumes).to.deep.include(newVolume);
            expect(resNew.spec.template.spec.volumes).to.deep.include(updateVolume);
            expect(resNew.spec.template.spec.volumes).to.not.deep.include(volume);
        });
    });

    describe('applyVolumeMounts', () => {
        it('should add volumeMount to spec', () => {
            const envLength = templateWorker.spec.template.spec.containers[0].volumeMounts.length;
            const newVolumeMounts = { name: 'storage-volume', mountPath: '/hkubedata' };
            const res = applyVolumeMounts(templateWorker, CONTAINERS.WORKER, newVolumeMounts);
            expect(res.spec.template.spec.containers[0].volumeMounts).to.have.lengthOf(envLength + 1);
            expect(res.spec.template.spec.containers[0].volumeMounts).to.deep.include(newVolumeMounts);
        });
        it('should replace volumeMount in spec', () => {
            const volumeMounts = { name: 'storage-volume', mountPath: '/hkubedata1' };
            const newVolumeMounts = { name: 'storage-volume', mountPath: '/hkubedata2' };
            const res = applyVolumeMounts(templateWorker, CONTAINERS.WORKER, volumeMounts);
            const envLength = res.spec.template.spec.containers[0].volumeMounts.length;
            const resNew = applyVolumeMounts(res, CONTAINERS.WORKER, newVolumeMounts);
            expect(resNew.spec.template.spec.containers[0].volumeMounts).to.have.lengthOf(envLength);
            expect(resNew.spec.template.spec.containers[0].volumeMounts).to.deep.include(newVolumeMounts);
            expect(resNew.spec.template.spec.containers[0].volumeMounts).to.not.deep.include(volumeMounts);
        });
    });

    describe('createDriverJobSpec', () => {
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
        it('should apply with worker and resources', () => {
            const res = createDriverJobSpec({
                ...{ options },
                image: 'myImage1',
                resourceRequests: { requests: { cpu: '200m' }, limits: { cpu: '500m', memory: '200M' } }
            });
            expect(res).to.nested.include({ 'spec.template.spec.containers[0].image': 'myImage1' });
            expect(res.metadata.name).to.include(CONTAINERS.PIPELINE_DRIVER);
            expect(res.spec.template.spec.containers[0].resources).to.deep.include({ requests: { cpu: '200m' } });
            expect(res.spec.template.spec.containers[0].resources).to.deep.include({ limits: { cpu: '500m', memory: '200M' } });
        });
    });
});
