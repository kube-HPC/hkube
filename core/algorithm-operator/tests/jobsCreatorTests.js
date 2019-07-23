const configIt = require('@hkube/config');
const Logger = require('@hkube/logger');
const { main, logger } = configIt.load();
const log = new Logger(main.serviceName, logger);

const { expect } = require('chai');
const { createBuildJobSpec, applyName } = require('../lib/jobs/algorithm-builds');
const { jobTemplate } = require('../lib/templates/algorithm-builder');

describe('jobCreator', () => {
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
            options
        });
        expect(res.spec.template.spec.containers).to.be.of.length(2);
        expect(res.spec.template.spec.containers[1].name).to.eql('kaniko');
        expect(res.spec.template.spec.containers[1].image).to.eql('hkube/kaniko:v1.1.0');
        expect(res.spec.template.spec.containers[1].securityContext).to.not.exist;
        expect(res.spec.template.spec.containers[0].securityContext).to.not.exist;
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
        const res = createBuildJobSpec({ buildId, versions: { versions: [{ project: 'algorithm-builder', tag: 'v1.2' }] }, secret: {
            metadata: {
                name: 'test'
            },
            data: {
                
            }
        }, options });
        expect(res.spec.template.spec.containers).to.be.of.length(1);
        expect(res.spec.template.spec.containers[0].securityContext.privileged).to.be.true;
    });
});
