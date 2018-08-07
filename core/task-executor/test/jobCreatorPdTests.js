const clonedeep = require('lodash.clonedeep');
const configIt = require('@hkube/config');
const Logger = require('@hkube/logger');
const { main, logger } = configIt.load();
const log = new Logger(main.serviceName, logger);
const { expect } = require('chai');
const { applyPipelineDriverImage, createDriverJobSpec, applyEnvToContainer } = require('../lib/jobs/jobCreator');
const template = require('../lib/templates').pipelineDriverTemplate;
const CONTAINERS = require('../common/consts/containers');

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
    describe('createDriverJobSpec', () => {
        it('should throw if no image name', () => {
            expect(() => createDriverJobSpec({})).to.throw('Unable to create job spec. image is required');
        });
        it('should apply all required properties', () => {
            const res = createDriverJobSpec({ image: 'myImage1' });
            expect(res).to.nested.include({ 'spec.template.spec.containers[0].image': 'myImage1' });
            expect(res.metadata.name).to.include(CONTAINERS.PIPELINE_DRIVER);
        });
        it('should apply with worker', () => {
            const res = createDriverJobSpec({ image: 'myImage1' });
            expect(res).to.nested.include({ 'spec.template.spec.containers[0].image': 'myImage1' });
            expect(res.metadata.name).to.include(CONTAINERS.PIPELINE_DRIVER);
        });
        it('should apply with worker and resources', () => {
            const res = createDriverJobSpec({
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
