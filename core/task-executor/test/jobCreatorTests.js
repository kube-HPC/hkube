const clonedeep = require('lodash.clonedeep');
const configIt = require('@hkube/config');
const Logger = require('@hkube/logger');
const { main, logger } = configIt.load();
const log = new Logger(main.serviceName, logger);

const { expect } = require('chai');
const { applyAlgorithmImage, applyAlgorithmName, applyWorkerImage, createJobSpec } = require('../lib/jobs/jobCreator');
const { jobTemplate } = require('./stub/jobTemplates');
describe('jobCreator', () => {
    describe('applyAlgorithmName', () => {
        it('should replace image name in spec', () => {
            const res = applyAlgorithmName(jobTemplate, 'myAlgo1');
            expect(res).to.nested.include({ 'metadata.labels.algorithm-name': 'myAlgo1' });
        });
        it('should throw if no worker container', () => {
            const missingWorkerSpec = clonedeep(jobTemplate);
            missingWorkerSpec.spec.template.spec.containers.splice(0, 1);
            expect(() => applyAlgorithmName(missingWorkerSpec, 'myAlgo1')).to.throw('Unable to create job spec. worker container not found');
        });
    });
    describe('applyImageName', () => {
        it('should replace algorithm image name in spec', () => {
            const res = applyAlgorithmImage(jobTemplate, 'registry:5000/myAlgo1Image:v2');
            expect(res).to.nested.include({ 'spec.template.spec.containers[1].image': 'registry:5000/myAlgo1Image:v2' });
        });
        it('should throw if no algorithm container', () => {
            const missingAlgorunnerSpec = clonedeep(jobTemplate);
            missingAlgorunnerSpec.spec.template.spec.containers.splice(1, 1);
            expect(() => applyAlgorithmImage(missingAlgorunnerSpec, 'registry:5000/myAlgo1Image:v2')).to.throw('Unable to create job spec. algorithm container not found');
        });
    });
    describe('applyWorkerImageName', () => {
        it('should replace worker image name in spec', () => {
            const res = applyAlgorithmImage(jobTemplate, 'workerImage:v2');
            expect(res).to.nested.include({ 'spec.template.spec.containers[1].image': 'workerImage:v2' });
        });
        it('should throw if no worker container2', () => {
            const missingWorkerSpec = clonedeep(jobTemplate);
            missingWorkerSpec.spec.template.spec.containers.splice(0, 1);
            expect(() => applyWorkerImage(missingWorkerSpec, 'workerImage:v2')).to.throw('Unable to create job spec. worker container not found');
        });
    });
    it('should throw if no image name', () => {
        expect(() => createJobSpec({ algorithmName: 'myalgo1' })).to.throw('Unable to create job spec. algorithmImage is required');
    });
    it('should throw if no algorithm name', () => {
        expect(() => createJobSpec({ algorithmImage: 'myImage1' })).to.throw('Unable to create job spec. algorithmName is required');
    });
    it('should apply all required properties', () => {
        const res = createJobSpec({ algorithmImage: 'myImage1', algorithmName: 'myalgo1' });
        expect(res).to.nested.include({ 'spec.template.spec.containers[1].image': 'myImage1' });
        expect(res).to.nested.include({ 'metadata.labels.algorithm-name': 'myalgo1' });
        expect(res).to.nested.include({ 'spec.template.spec.containers[0].image': 'hkube/worker:latest' });
        
        expect(res.metadata.name).to.include('myalgo1-');
    });

    it('should apply with worker', () => {
        const res = createJobSpec({ algorithmImage: 'myImage1', algorithmName: 'myalgo1', workerImage: 'workerImage2' });
        expect(res).to.nested.include({ 'spec.template.spec.containers[0].image': 'workerImage2' });
        expect(res).to.nested.include({ 'spec.template.spec.containers[1].image': 'myImage1' });
        expect(res).to.nested.include({ 'metadata.labels.algorithm-name': 'myalgo1' });
        expect(res.metadata.name).to.include('myalgo1-');
    });

    it('should apply with worker and resources', () => {
        const res = createJobSpec({
            algorithmImage: 'myImage1',
            algorithmName: 'myalgo1',
            workerImage: 'workerImage2',
            resourceRequests: { cpu: '200m' },
            resourceLimits: { cpu: '500m', memory: '200M' },
        });
        expect(res).to.nested.include({ 'spec.template.spec.containers[0].image': 'workerImage2' });
        expect(res).to.nested.include({ 'spec.template.spec.containers[1].image': 'myImage1' });
        expect(res).to.nested.include({ 'metadata.labels.algorithm-name': 'myalgo1' });
        expect(res.metadata.name).to.include('myalgo1-');
        expect(res.spec.template.spec.containers[1].resources).to.deep.include({ requests: { cpu: '200m' } });
        expect(res.spec.template.spec.containers[1].resources).to.deep.include({ limits: { cpu: '500m', memory: '200M' } });
    });
});
