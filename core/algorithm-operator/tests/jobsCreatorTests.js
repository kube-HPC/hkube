const configIt = require('@hkube/config');
const Logger = require('@hkube/logger');
const { main, logger } = configIt.load();
const log = new Logger(main.serviceName, logger);

const { expect } = require('chai');
const { createBuildJobSpec, applyName } = require('../lib/jobs/algorithm-builds');
const { jobTemplate } = require('../lib/templates/algorithm-builder');
const { settings } = require('../lib/helpers/settings');

describe('jobCreator', () => {
    beforeEach(() => {
        settings.applyResourceLimits = false;
    });
    it('should replace image name in spec', () => {
        const res = applyName(jobTemplate, 'myAlgo1');
        expect(res).to.nested.include({ 'metadata.name': 'build-myAlgo1' });
    });
    it('should throw if no algorithm name', () => {
        expect(() => createBuildJobSpec({ version: 'v1.2' })).to.throw('Unable to create job spec. buildId is required');
    });
    it('should apply all required properties', () => {
        const buildId = 'my-alg-12345'
        const res = createBuildJobSpec({
            buildId, versions: { versions: [{ project: 'algorithm-builder', tag: 'v1.2' }] }, secret: {
                metadata: {
                    name: 'test'
                },
                data: {

                }
            }, options: main
        });
        expect(res).to.nested.include({ 'metadata.name': 'build-' + buildId });
        expect(res).to.nested.include({ 'spec.template.spec.containers[0].image': 'hkube/algorithm-builder:v1.2' });
        expect(res).to.nested.include({ 'metadata.labels.build-id': buildId });
        expect(res).to.nested.include({ 'metadata.labels.type': 'algorithm-builder' });
    });
    it('should add kaniko if needed', () => {
        settings.applyResourceLimits = true;
        settings.resourcesMain = {
            memory: 256,
            cpu: 0.1
        }
        settings.resourcesBuilder = {
            memory: 300,
            cpu: 0.2
        }
        const buildId = 'my-alg-12345'
        const options = {
            ...main,
            buildMode: 'kaniko'
        }
        
        const res = createBuildJobSpec({
            buildId, versions: {
                versions: [
                    {
                        project: 'algorithm-builder', tag: 'v1.2'
                    },
                    {
                        project: 'kaniko', tag: 'v1.1.0'
                    }]
            }, secret: {
                metadata: {
                    name: 'test'
                },
                data: {

                }
            },
            options,
        });
        expect(res.spec.template.spec.containers).to.be.of.length(2);
        expect(res.spec.template.spec.containers[1].name).to.eql('kaniko');
        expect(res.spec.template.spec.containers[1].image).to.eql('hkube/kaniko:v1.1.0');
        expect(res.spec.template.spec.containers[1].securityContext).to.not.exist;
        expect(res.spec.template.spec.containers[0].securityContext).to.not.exist;
        expect(res.spec.template.spec.containers[1].resources.limits).to.eql({ cpu: 0.4, memory: "600Mi" });
        expect(res.spec.template.spec.containers[0].resources.requests).to.eql({ cpu: 0.1, memory: "256Mi" });

    });
    it('should add openshift if needed', () => {
        settings.applyResourceLimits = true;
        settings.resourcesMain = {
            memory: 256,
            cpu: 0.1
        }
        settings.resourcesBuilder = {
            memory: 300,
            cpu: 0.2
        }
        const buildId = 'my-alg-12345'
        const options = {
            ...main,
            buildMode: 'openshift'
        }
        
        const res = createBuildJobSpec({
            buildId, versions: {
                versions: [
                    {
                        project: 'algorithm-builder', tag: 'v1.2'
                    },
                    {
                        project: 'oc-builder', tag: 'v1.1.0'
                    }]
            }, secret: {
                metadata: {
                    name: 'test'
                },
                data: {

                }
            },
            options,
        });
        expect(res.spec.template.spec.containers).to.be.of.length(2);
        expect(res.spec.template.spec.containers[1].name).to.eql('oc-builder');
        expect(res.spec.template.spec.containers[1].image).to.eql('hkube/oc-builder:v1.1.0');
        expect(res.spec.template.spec.containers[1].securityContext).to.not.exist;
        expect(res.spec.template.spec.containers[0].securityContext).to.not.exist;
        expect(res.spec.template.spec.containers[1].resources.limits).to.eql({ cpu: 0.4, memory: "600Mi" });
        expect(res.spec.template.spec.containers[0].resources.requests).to.eql({ cpu: 0.1, memory: "256Mi" });

    });
    it('should add kaniko if needed without resources', () => {
        const buildId = 'my-alg-12345'
        const options = {
            ...main,
            buildMode: 'kaniko'
        }
        const resourcesMain = {
            memory: 256,
            cpu: 0.1
        }
        const resourcesBuilder = {
            memory: 300,
            cpu: 0.2
        }
        const res = createBuildJobSpec({
            buildId, versions: {
                versions: [
                    {
                        project: 'algorithm-builder', tag: 'v1.2'
                    },
                    {
                        project: 'kaniko', tag: 'v1.1.0'
                    }]
            }, secret: {
                metadata: {
                    name: 'test'
                },
                data: {

                }
            },
            options,
            resourcesBuilder,
            resourcesMain,
            algorithmBuilderResourcesEnable: false
        });
        expect(res.spec.template.spec.containers).to.be.of.length(2);
        expect(res.spec.template.spec.containers[1].name).to.eql('kaniko');
        expect(res.spec.template.spec.containers[1].image).to.eql('hkube/kaniko:v1.1.0');
        expect(res.spec.template.spec.containers[1].securityContext).to.not.exist;
        expect(res.spec.template.spec.containers[0].securityContext).to.not.exist;
        expect(res.spec.template.spec.containers[1].resources).to.not.exist;

    });
    it('should add kaniko if needed with registry', () => {
        const buildId = 'my-alg-12345'
        const options = {
            ...main,
            buildMode: 'kaniko'
        }
        const res = createBuildJobSpec({
            buildId, versions: {
                versions: [
                    {
                        project: 'algorithm-builder', tag: 'v1.2'
                    },
                    {
                        project: 'kaniko', tag: 'v1.1.0'
                    }]
            },
            options,
            registry: {
                registry: 'my-reg:5000'
            }, secret: {
                metadata: {
                    name: 'test'
                },
                data: {

                }
            }
        });
        expect(res.spec.template.spec.containers).to.be.of.length(2);
        expect(res.spec.template.spec.containers[1].name).to.eql('kaniko');
        expect(res.spec.template.spec.containers[1].image).to.eql('my-reg:5000/hkube/kaniko:v1.1.0');
        expect(res.spec.template.spec.containers[1].securityContext).to.not.exist;
        expect(res.spec.template.spec.containers[0].securityContext).to.not.exist;
    });
    it('should not add kaniko if not needed', () => {
        const buildId = 'my-alg-12345'
        const options = {
            ...main,
            buildMode: 'docker'
        }
        const res = createBuildJobSpec({
            buildId, versions: { versions: [{ project: 'algorithm-builder', tag: 'v1.2' }] }, secret: {
                metadata: {
                    name: 'test'
                },
                data: {

                }
            }, options
        });
        expect(res.spec.template.spec.containers).to.be.of.length(1);
        expect(res.spec.template.spec.containers[0].securityContext.privileged).to.be.true;
    });
    it('should add imagePullSecret', () => {
        const buildId = 'my-alg-12345'
        const options = {
            ...main,
            buildMode: 'docker'
        }
        const res = createBuildJobSpec({
            buildId, versions: { versions: [{ project: 'algorithm-builder', tag: 'v1.2' }] }, secret: {
                metadata: {
                    name: 'test'
                },
                data: {

                }
            },
            options,
            clusterOptions: {imagePullSecretName: 'my-secret'}
        });
        expect(res.spec.template.spec.imagePullSecrets).to.exist;
        expect(res.spec.template.spec.imagePullSecrets[0]).to.eql({name: 'my-secret'});
    });
});
