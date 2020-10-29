const clonedeep = require('lodash.clonedeep');
const configIt = require('@hkube/config');
const Logger = require('@hkube/logger');
const { main, logger } = configIt.load();
const log = new Logger(main.serviceName, logger);
const { settings } = require('../lib/helpers/settings');

const { expect } = require('chai');
const { createDeploymentSpec, applyAlgorithmName, applyNodeSelector } = require('../lib/deployments/algorithm-queue');
const { algorithmQueueTemplate } = require('./stub/deploymentTemplates');

describe('deploymentCreator', () => {
    beforeEach(() => {
        settings.applyResourceLimits = false;
    });
    describe('applyAlgorithmName', () => {
        it('should replace image name in spec', () => {
            const res = applyAlgorithmName(algorithmQueueTemplate, 'myAlgo1', 'algorithm-queue');
            expect(res).to.nested.include({ 'metadata.labels.algorithm-name': 'myAlgo1' });
            expect(res).to.nested.include({ 'spec.template.metadata.labels.algorithm-name': 'myAlgo1' });
            expect(res).to.nested.include({ 'spec.selector.matchLabels.algorithm-name': 'myAlgo1' });
        });
        it('should throw if no worker container', () => {
            const missingWorkerSpec = clonedeep(algorithmQueueTemplate);
            missingWorkerSpec.spec.template.spec.containers.splice(0, 1);
            expect(() => applyAlgorithmName(missingWorkerSpec, 'myAlgo1', 'algorithm-queue')).to.throw('unable to find container algorithm-queue');
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
        const res = createDeploymentSpec({ algorithmName: 'myalgo1', options: { kubernetes: {} } });
        expect(res).to.nested.include({ 'metadata.name': 'algorithm-queue-myalgo1' });
        expect(res).to.nested.include({ 'spec.template.spec.containers[0].image': 'hkube/algorithm-queue' });
        expect(res).to.nested.include({ 'metadata.labels.algorithm-name': 'myalgo1' });
    });
    it('should apply jaeger privileged', () => {
        const res = createDeploymentSpec({ algorithmName: 'myalgo1', options: { kubernetes: { isPrivileged: true } } });
        expect(res.spec.template.spec.containers[0].env.find(e => e.name === 'JAEGER_AGENT_SERVICE_HOST')).to.have.property('valueFrom')
    });
    it('should apply jaeger not privileged', () => {
        const res = createDeploymentSpec({ algorithmName: 'myalgo1', options: { kubernetes: { isPrivileged: false } } });
        expect(res.spec.template.spec.containers[0].env.find(e => e.name === 'JAEGER_AGENT_SERVICE_HOST')).to.be.undefined;
    });
    it('should apply jaeger not privileged with external host', () => {
        const res = createDeploymentSpec({ algorithmName: 'myalgo1', options: { kubernetes: { isPrivileged: false } ,jaeger: { host: 'foo.bar' }} });
        expect(res.spec.template.spec.containers[0].env.find(e => e.name === 'JAEGER_AGENT_SERVICE_HOST').value).to.eql('foo.bar');
    });
    it('should apply all required properties - camel case', () => {
        const res = createDeploymentSpec({ algorithmName: 'myAlgoStam', options: { kubernetes: {} } });
        expect(res).to.nested.include({ 'metadata.name': 'algorithm-queue-my-algo-stam' });
        expect(res).to.nested.include({ 'spec.template.spec.containers[0].image': 'hkube/algorithm-queue' });
        expect(res).to.nested.include({ 'metadata.labels.algorithm-name': 'myAlgoStam' });
    });

    it('should add imagePullSecret', () => {
        const res = createDeploymentSpec({ algorithmName: 'myAlgoStam', options: { kubernetes: {} }, clusterOptions: {imagePullSecretName: 'my-secret'} });
        expect(res.spec.template.spec.imagePullSecrets).to.exist;
        expect(res.spec.template.spec.imagePullSecrets[0]).to.eql({name: 'my-secret'});
    });

    it('should apply resources', () => {
        settings.applyResourceLimits = true;
        const resources = {
            memory: 256,
            cpu: 0.2
        }
        const res = createDeploymentSpec({ algorithmName: 'myAlgoStam', resources, options: { kubernetes: {} } });
        expect(res).to.nested.include({ 'spec.template.spec.containers[0].resources.limits.memory': '512Mi' });
        expect(res).to.nested.include({ 'spec.template.spec.containers[0].resources.limits.cpu': 0.4 });
        expect(res).to.nested.include({ 'spec.template.spec.containers[0].resources.requests.memory': '256Mi' });
        expect(res).to.nested.include({ 'spec.template.spec.containers[0].resources.requests.cpu': 0.2 });
    });

    it('should not apply resources', () => {
        const resources = {
            memory: 256,
            cpu: 0.2
        }
        const res = createDeploymentSpec({ algorithmName: 'myAlgoStam', resources, options: { kubernetes: {} } });
        expect(res.spec.template.spec.containers[0].resources).to.not.exist;
    });
});
