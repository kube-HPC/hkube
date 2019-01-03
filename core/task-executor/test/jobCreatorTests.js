const clonedeep = require('lodash.clonedeep');
const configIt = require('@hkube/config');
const Logger = require('@hkube/logger');
const { main, logger } = configIt.load();
const log = new Logger(main.serviceName, logger);
const options = main;
const { expect } = require('chai');
const { applyAlgorithmImage, applyAlgorithmName, applyWorkerImage, createJobSpec, applyEnvToContainer, applyNodeSelector } = require('../lib/jobs/jobCreator'); // eslint-disable-line object-curly-newline
const { jobTemplate } = require('./stub/jobTemplates');
const { awsAccessKeyId, awsSecretAccessKey, s3EndpointUrl } = require('../lib/templates/s3-template');
const { fsBaseDirectory, fsVolumeMounts, fsVolumes } = require('../lib/templates/fs-template');

describe('jobCreator', () => {
    describe('applyAlgorithmName', () => {
        it('should replace image name in spec', () => {
            const res = applyAlgorithmName(jobTemplate, 'myAlgo1');
            expect(res).to.nested.include({ 'metadata.labels.algorithm-name': 'myAlgo1' });
            expect(res).to.nested.include({ 'spec.template.metadata.labels.algorithm-name': 'myAlgo1' });
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
            expect(() => applyAlgorithmImage(missingAlgorunnerSpec, 'registry:5000/myAlgo1Image:v2')).to.throw('Unable to create job spec. algorunner container not found');
        });
    });
    describe('applyWorkerImageName', () => {
        it('should replace worker image name in spec', () => {
            const res = applyWorkerImage(jobTemplate, 'workerImage:v2');
            expect(res).to.nested.include({ 'spec.template.spec.containers[0].image': 'workerImage:v2' });
        });
        it('should throw if no worker container2', () => {
            const missingWorkerSpec = clonedeep(jobTemplate);
            missingWorkerSpec.spec.template.spec.containers.splice(0, 1);
            expect(() => applyWorkerImage(missingWorkerSpec, 'workerImage:v2')).to.throw('Unable to create job spec. worker container not found');
        });
    });

    describe('useNodeSelector', () => {
        it('should remove node selector in spec', () => {
            const res = applyNodeSelector(jobTemplate, { useNodeSelector: false });
            expect(res.spec.template.spec.nodeSelector).to.be.undefined;
        });
        it('should remove node selector in spec 2', () => {
            const res = applyNodeSelector(jobTemplate);
            expect(res.spec.template.spec.nodeSelector).to.be.undefined;
        });
        it('should not remove node selector in spec', () => {
            const res = applyNodeSelector(jobTemplate, { useNodeSelector: true });
            expect(res.spec.template.spec.nodeSelector).to.exist;
        });
    });

    describe('applyEnvToContainer', () => {
        it('should add env to spec', () => {
            const res = applyEnvToContainer(jobTemplate, 'worker', { env1: 'value1' });
            expect(res.spec.template.spec.containers[0].env).to.have.lengthOf(6);
            expect(res.spec.template.spec.containers[0].env).to.deep.include({ name: 'env1', value: 'value1' });
        });
        it('should replace env in spec', () => {
            const res = applyEnvToContainer(jobTemplate, 'worker', { NODE_ENV: 'newEnv' });
            expect(res.spec.template.spec.containers[0].env).to.have.lengthOf(5);
            expect(res.spec.template.spec.containers[0].env).to.deep.include({ name: 'NODE_ENV', value: 'newEnv' });
        });
        it('should remove env in spec', () => {
            const res = applyEnvToContainer(jobTemplate, 'worker', { NODE_ENV: null });
            expect(res.spec.template.spec.containers[0].env).to.have.lengthOf(4);
            expect(res.spec.template.spec.containers[0].env).to.not.deep.include({ name: 'NODE_ENV', value: 'kube' });
        });
        it('combine', () => {
            const res = applyEnvToContainer(jobTemplate, 'worker', { NODE_ENV: null, ALGORITHM_TYPE: 'myalgo', newEnv: 3 });
            expect(res.spec.template.spec.containers[0].env).to.have.lengthOf(5);
            expect(res.spec.template.spec.containers[0].env).to.not.deep.include({ name: 'NODE_ENV', value: 'kube' });
            expect(res.spec.template.spec.containers[0].env).to.deep.include({ name: 'ALGORITHM_TYPE', value: 'myalgo' });
            expect(res.spec.template.spec.containers[0].env).to.deep.include({ name: 'newEnv', value: '3' });
        });
        it('should add env to algorunner spec', () => {
            const res = applyEnvToContainer(jobTemplate, 'algorunner', { newEnv: 3 });
            expect(res.spec.template.spec.containers[1].env).to.have.lengthOf(1);
            expect(res.spec.template.spec.containers[1].env).to.deep.include({ name: 'newEnv', value: '3' });
        });
        it('should add string env to algorunner spec', () => {
            const res = applyEnvToContainer(jobTemplate, 'algorunner', { newEnv: '5' });
            expect(res.spec.template.spec.containers[1].env).to.have.lengthOf(1);
            expect(res.spec.template.spec.containers[1].env).to.deep.include({ name: 'newEnv', value: '5' });
        });
        it('should add object env to algorunner spec', () => {
            const res = applyEnvToContainer(jobTemplate, 'algorunner', { newEnv: { key1: { key2: 'value' } } });
            expect(res.spec.template.spec.containers[1].env).to.have.lengthOf(1);
            expect(res.spec.template.spec.containers[1].env).to.deep.include({ name: 'newEnv', value: { key1: { key2: 'value' } } });
        });
    });
    it('should throw if no image name', () => {
        expect(() => createJobSpec({ algorithmName: 'myalgo1', options })).to.throw('Unable to create job spec. algorithmImage is required');
    });
    it('should throw if no algorithm name', () => {
        expect(() => createJobSpec({ algorithmImage: 'myImage1', options })).to.throw('Unable to create job spec. algorithmName is required');
    });
    it('should apply all required properties', () => {
        const res = createJobSpec({ algorithmImage: 'myImage1', algorithmName: 'myalgo1', options });
        expect(res).to.nested.include({ 'spec.template.spec.containers[1].image': 'myImage1' });
        expect(res).to.nested.include({ 'metadata.labels.algorithm-name': 'myalgo1' });
        expect(res).to.nested.include({ 'spec.template.spec.containers[0].image': 'hkube/worker:latest' });

        expect(res.metadata.name).to.include('myalgo1-');
    });

    it('should apply with worker', () => {
        const res = createJobSpec({ algorithmImage: 'myImage1', algorithmName: 'myalgo1', workerImage: 'workerImage2', options });
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
            options,
            resourceRequests: { requests: { cpu: '200m' }, limits: { cpu: '500m', memory: '200M' } }
        });
        expect(res).to.nested.include({ 'spec.template.spec.containers[0].image': 'workerImage2' });
        expect(res).to.nested.include({ 'spec.template.spec.containers[1].image': 'myImage1' });
        expect(res).to.nested.include({ 'metadata.labels.algorithm-name': 'myalgo1' });
        expect(res.metadata.name).to.include('myalgo1-');
        expect(res.spec.template.spec.containers[1].resources).to.deep.include({ requests: { cpu: '200m' } });
        expect(res.spec.template.spec.containers[1].resources).to.deep.include({ limits: { cpu: '500m', memory: '200M' } });
    });

    it('create job with volume', () => {
        const res = createJobSpec({
            algorithmImage: 'myImage1', algorithmName: 'myalgo1', workerImage: 'workerImage2',
            fsBaseDirectory, fsVolumeMounts, fsVolumes, options: { defaultStorage: 'fs' }
        });
        expect(res).to.nested.include({ 'spec.template.spec.containers[0].image': 'workerImage2' });
        expect(res).to.nested.include({ 'spec.template.spec.containers[1].image': 'myImage1' });
        expect(res).to.nested.include({ 'metadata.labels.algorithm-name': 'myalgo1' });
        expect(res.metadata.name).to.include('myalgo1-');
    });
});
