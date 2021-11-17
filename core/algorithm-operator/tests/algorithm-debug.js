const configIt = require('@hkube/config');
const Logger = require('@hkube/logger');
const { main, logger } = configIt.load();
const log = new Logger(main.serviceName, logger);
const options = main;
const { expect } = require('chai');
let createIngressServiceSpec;

describe('jobCreator', () => {
    before(() => {
        createIngressServiceSpec = require('../lib/deployments/algorithm-debug.js').createIngressServiceSpec;

    })
    describe('createIngressServiceSpec', () => {
        describe('kubeVersion v1.18', () => {
            it('should include algorithm name and host', () => {
                const { serviceSpec, ingressSpec } = createIngressServiceSpec({ algorithmName: 'myalgo1-debug', debugName: 'myalgo1', clusterOptions: { ingressHost: 'myhost' } });
                expect(ingressSpec).to.nested.include({ 'spec.rules[0].host': 'myhost' });
                expect(ingressSpec).to.nested.include({ 'spec.rules[0].http.paths[0].path': '/hkube/debug/myalgo1' });
                expect(ingressSpec.spec.rules[0].http.paths[0].backend).to.eql({ serviceName: 'service-debug-myalgo1-debug', servicePort: 80 });
                expect(ingressSpec.spec.rules[0].http.paths[0].pathTyep).to.not.exist;
                expect(serviceSpec).to.nested.include({ 'spec.selector.algorithm-name': 'myalgo1-debug' });
            });
        })
        describe('kubeVersion v1.19', () => {
            before(() => {
                global.testParams.kubernetes.mock.kubeVersion.version = 'v1.19'
            });
            after(() => {
                global.testParams.kubernetes.mock.kubeVersion.version = 'v1.18'
            });
            it('should include algorithm name and host', () => {
                const { serviceSpec, ingressSpec } = createIngressServiceSpec({ algorithmName: 'myalgo1-debug', debugName: 'myalgo1', clusterOptions: { ingressHost: 'myhost' } });
                expect(ingressSpec).to.nested.include({ 'spec.rules[0].host': 'myhost' });
                expect(ingressSpec).to.nested.include({ 'spec.rules[0].http.paths[0].path': '/hkube/debug/myalgo1' });
                expect(ingressSpec.spec.rules[0].http.paths[0].backend).to.eql({ serviceName: 'service-debug-myalgo1-debug', servicePort: 80 });
                expect(ingressSpec.spec.rules[0].http.paths[0].pathTyep).to.not.exist;
                expect(serviceSpec).to.nested.include({ 'spec.selector.algorithm-name': 'myalgo1-debug' });
            });
        })
        describe('kubeVersion v1.21', () => {
            before(() => {
                global.testParams.kubernetes.mock.kubeVersion.version = 'v1.21'
            });
            after(() => {
                global.testParams.kubernetes.mock.kubeVersion.version = 'v1.18'
            });
            it('should include algorithm name and host', () => {
                const { serviceSpec, ingressSpec } = createIngressServiceSpec({ algorithmName: 'myalgo1-debug', debugName: 'myalgo1', clusterOptions: { ingressHost: 'myhost' } });
                expect(ingressSpec).to.nested.include({ 'spec.rules[0].host': 'myhost' });
                expect(ingressSpec).to.nested.include({ 'spec.rules[0].http.paths[0].path': '/hkube/debug/myalgo1' });
                expect(ingressSpec.spec.rules[0].http.paths[0].backend).to.eql({
                    service: {
                        name: 'service-debug-myalgo1-debug',
                        port: {
                            number: 80
                        }
                    }
                });
                expect(ingressSpec.spec.rules[0].http.paths[0].pathType).to.exist;
                expect(serviceSpec).to.nested.include({ 'spec.selector.algorithm-name': 'myalgo1-debug' });
            });
        })
        describe('kubeVersion v1.22', () => {
            before(() => {
                global.testParams.kubernetes.mock.kubeVersion.version = 'v1.22'
            });
            after(() => {
                global.testParams.kubernetes.mock.kubeVersion.version = 'v1.18'
            });
            it('should include algorithm name and host', () => {
                const { serviceSpec, ingressSpec } = createIngressServiceSpec({ algorithmName: 'myalgo1-debug', debugName: 'myalgo1', clusterOptions: { ingressHost: 'myhost' } });
                expect(ingressSpec).to.nested.include({ 'spec.rules[0].host': 'myhost' });
                expect(ingressSpec).to.nested.include({ 'spec.rules[0].http.paths[0].path': '/hkube/debug/myalgo1' });
                expect(ingressSpec.spec.rules[0].http.paths[0].backend).to.eql({
                    service: {
                        name: 'service-debug-myalgo1-debug',
                        port: {
                            number: 80
                        }
                    }
                });
                expect(ingressSpec.spec.rules[0].http.paths[0].pathType).to.exist;
                expect(serviceSpec).to.nested.include({ 'spec.selector.algorithm-name': 'myalgo1-debug' });
            });
        })
    });
});
