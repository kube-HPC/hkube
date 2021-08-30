const clonedeep = require('lodash.clonedeep');
const { settings } = require('../lib/helpers/settings');
const { expect } = require('chai');
const { algorithmQueueTemplate } = require('./stub/deploymentTemplates');
let config;
let createDeploymentSpec, applyQueueId, applyNodeSelector;

describe('deploymentCreator', () => {
    before(() => {
        config = global.testParams.config;
        ({ createDeploymentSpec, applyQueueId, applyNodeSelector } = require('../lib/deployments/algorithm-queue'));
    });
    beforeEach(() => {
        settings.applyResourceLimits = false;
    });
    describe('applyQueueId', () => {
        it('should replace image name in spec', () => {
            const res = applyQueueId(algorithmQueueTemplate, 'myAlgo1', 'algorithm-queue');
            expect(res).to.nested.include({ 'metadata.labels.queue-id': 'myAlgo1' });
            expect(res).to.nested.include({ 'spec.template.metadata.labels.queue-id': 'myAlgo1' });
            expect(res).to.nested.include({ 'spec.selector.matchLabels.queue-id': 'myAlgo1' });
        });
        it('should throw if no worker container', () => {
            const missingWorkerSpec = clonedeep(algorithmQueueTemplate);
            missingWorkerSpec.spec.template.spec.containers.splice(0, 1);
            expect(() => applyQueueId(missingWorkerSpec, 'myAlgo1', 'algorithm-queue')).to.throw('unable to find container algorithm-queue');
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
        expect(() => createDeploymentSpec({ algorithmImage: 'myImage1' })).to.throw('Unable to create deployment spec. queueId is required');
    });
    it('should apply all required properties', () => {
        const res = createDeploymentSpec({ queueId: 'myalgo1', options: { kubernetes: {} } });
        expect(res).to.nested.include({ 'metadata.name': 'algorithm-queue-myalgo1' });
        expect(res).to.nested.include({ 'spec.template.spec.containers[0].image': 'hkube/algorithm-queue' });
        expect(res).to.nested.include({ 'metadata.labels.queue-id': 'myalgo1' });
    });
    it('should apply jaeger privileged', () => {
        const res = createDeploymentSpec({ queueId: 'myalgo1', options: { kubernetes: { isPrivileged: true } } });
        expect(res.spec.template.spec.containers[0].env.find(e => e.name === 'JAEGER_AGENT_SERVICE_HOST')).to.have.property('valueFrom')
    });
    it('should apply jaeger not privileged', () => {
        const res = createDeploymentSpec({ queueId: 'myalgo1', options: { kubernetes: { isPrivileged: false } } });
        expect(res.spec.template.spec.containers[0].env.find(e => e.name === 'JAEGER_AGENT_SERVICE_HOST')).to.be.undefined;
    });
    it('should apply jaeger not privileged with external host', () => {
        const res = createDeploymentSpec({ queueId: 'myalgo1', options: { kubernetes: { isPrivileged: false }, jaeger: { host: 'foo.bar' } } });
        expect(res.spec.template.spec.containers[0].env.find(e => e.name === 'JAEGER_AGENT_SERVICE_HOST').value).to.eql('foo.bar');
    });
    it('should add imagePullSecret', () => {
        const res = createDeploymentSpec({ queueId: 'myAlgoStam', options: { kubernetes: {} }, clusterOptions: { imagePullSecretName: 'my-secret' } });
        expect(res.spec.template.spec.imagePullSecrets).to.exist;
        expect(res.spec.template.spec.imagePullSecrets[0]).to.eql({ name: 'my-secret' });
    });
    it('should apply resources', () => {
        settings.applyResourceLimits = true;
        const resources = {
            memory: 256,
            cpu: 0.2
        }
        const res = createDeploymentSpec({ queueId: 'myAlgoStam', resources, options: { kubernetes: {} } });
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
        const res = createDeploymentSpec({ queueId: 'myAlgoStam', resources, options: { kubernetes: {} } });
        expect(res.spec.template.spec.containers[0].resources).to.not.exist;
    });
    describe('sidecars', () => {
        before(() => {
            settings.sidecars = [{
                name: 'my-sidecar',
                container: [
                    { name: 'c1', image: 'foo/bar' },
                    { name: 'c2', image: 'foo/bar' }
                ],
                volumes: [
                    {
                        name: "v1",
                        emptyDir: {}
                    },
                    {
                        name: "v2",
                        configMap: {
                            name: "cm2"
                        }
                    }
                ],
                volumeMounts: [
                    {
                        name: "v2",
                        mountPath: '/tmp/foo'
                    }

                ],
                environments: [
                    {
                        name: "env1",
                        value: "val1"
                    },
                    {
                        name: "env2",
                        value: "val2"
                    }
                ]

            }]
        })
        after(() => {
            settings.sidecars = []
        });
        it('should not apply sidecar if not enabled', () => {
            const res = createDeploymentSpec({ queueId: 'myalgo1', options: { kubernetes: {} } });
            expect(res.spec.template.spec.containers).to.have.lengthOf(1)
        });
        it('should apply sidecar if enabled', () => {
            const res = createDeploymentSpec({ queueId: 'myalgo1', options: { kubernetes: {} }, clusterOptions: { "my-sidecarSidecarEnabled": true } });
            
            expect(res.spec.template.spec.containers).to.have.lengthOf(3)
            expect(res.spec.template.spec.containers[1].name).to.eql('c1')
            expect(res.spec.template.spec.containers[2].name).to.eql('c2')
            expect(res.spec.template.spec.volumes).to.deep.include(settings.sidecars[0].volumes[0])
            expect(res.spec.template.spec.volumes).to.deep.include(settings.sidecars[0].volumes[1])
            expect(res.spec.template.spec.containers[0].volumeMounts).to.deep.include(settings.sidecars[0].volumeMounts[0])
            expect(res.spec.template.spec.containers[0].env).to.deep.include(settings.sidecars[0].environments[0])
            expect(res.spec.template.spec.containers[0].env).to.deep.include(settings.sidecars[0].environments[1])
            expect(res.spec.template.spec.containers[1].env).to.not.exist;
        });
        it('should not apply sidecar if no sidecar configmap', () => {
            const res = createDeploymentSpec({ queueId: 'myalgo1', options: { kubernetes: {} }, clusterOptions: { "no-sidecarSidecarEnabled": true } });
            expect(res.spec.template.spec.containers).to.have.lengthOf(1)
        });
    })
});
