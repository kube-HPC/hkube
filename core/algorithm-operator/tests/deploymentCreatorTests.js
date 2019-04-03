const clonedeep = require('lodash.clonedeep');
const configIt = require('@hkube/config');
const Logger = require('@hkube/logger');
const { main, logger } = configIt.load();
const log = new Logger(main.serviceName, logger);

const { expect } = require('chai');
const { createDeploymentSpec, applyImage, applyAlgorithmName, applyName, applyNodeSelector } = require('../lib/deployments/deploymentCreator');
const { createImageName, parseImageName, isValidDeploymentName } = require('../lib/helpers/images');
const { algorithmQueueTemplate } = require('./stub/deploymentTemplates');

describe('deploymentCreator', () => {
    describe('applyAlgorithmName', () => {
        it('should replace image name in spec', () => {
            const res = applyAlgorithmName(algorithmQueueTemplate, 'myAlgo1');
            expect(res).to.nested.include({ 'metadata.labels.algorithm-name': 'myAlgo1' });
        });
        it('should throw if no worker container', () => {
            const missingWorkerSpec = clonedeep(algorithmQueueTemplate);
            missingWorkerSpec.spec.template.spec.containers.splice(0, 1);
            expect(() => applyAlgorithmName(missingWorkerSpec, 'myAlgo1')).to.throw('create deployment spec. algorithm-queue container not found');
        });
    });
    describe('applyImage', () => {
        it('should set image name in spec', () => {
            const res = applyImage(algorithmQueueTemplate, 'registry:5000/myAlgo1Image:v2');
            expect(res).to.nested.include({ 'spec.template.spec.containers[0].image': 'registry:5000/myAlgo1Image:v2' });
        });
        it('should throw if no algorithm container', () => {
            const missingAlgorunnerSpec = clonedeep(algorithmQueueTemplate);
            missingAlgorunnerSpec.spec.template.spec.containers.splice(0, 1);
            expect(() => applyImage(missingAlgorunnerSpec, 'registry:5000/myAlgo1Image:v2')).to.throw('Unable to create deployment spec. algorithm-queue container not found');
        });
    });
    describe('useNodeSelector', () => {
        it('should remove node selector in spec', () => {
            const res = applyNodeSelector(algorithmQueueTemplate, { useNodeSelector: false });
            expect(res.spec.template.spec.nodeSelector).to.be.undefined;
        });
        it('should remove node selector in spec 2', () => {
            const res = applyNodeSelector(algorithmQueueTemplate);
            expect(res.spec.template.spec.nodeSelector).to.be.undefined;
        });
        it('should not remove node selector in spec', () => {
            const res = applyNodeSelector(algorithmQueueTemplate, { useNodeSelector: true });
            expect(res.spec.template.spec.nodeSelector).to.exist;
        });
    });
    it('should throw if no algorithm name', () => {
        expect(() => createDeploymentSpec({ algorithmImage: 'myImage1' })).to.throw('Unable to create deployment spec. algorithmName is required');
    });
    it('should apply all required properties', () => {
        const res = createDeploymentSpec({ algorithmName: 'myalgo1' });
        expect(res).to.nested.include({ 'metadata.name': 'algorithm-queue-myalgo1' });
        expect(res).to.nested.include({ 'spec.template.spec.containers[0].image': 'hkube/algorithm-queue' });
        expect(res).to.nested.include({ 'metadata.labels.algorithm-name': 'myalgo1' });
    });

    it('should apply all required properties - camel case', () => {
        const res = createDeploymentSpec({ algorithmName: 'myAlgoStam' });
        expect(res).to.nested.include({ 'metadata.name': 'algorithm-queue-my-algo-stam' });
        expect(res).to.nested.include({ 'spec.template.spec.containers[0].image': 'hkube/algorithm-queue' });
        expect(res).to.nested.include({ 'metadata.labels.algorithm-name': 'myAlgoStam' });
    });

});
