const configIt = require('@hkube/config');
const Logger = require('@hkube/logger');
const { main, logger } = configIt.load();
const log = new Logger(main.serviceName, logger);
const options = main;
const { expect } = require('chai');
let createIngressServiceSpec;

describe('jobCreator', () => {
    before(() => {
        createKindsSpec = require('../lib/deployments/tensorboard.js').createKindsSpec;

    })
    describe('createIngressServiceSpec', () => {
        describe('kubeVersion v1.18', () => {
            it('should include algorithm name and host', () => {
                const { serviceSpec, ingressSpec } = createKindsSpec({ boardReference: 'myalgo1-board', clusterOptions: { ingressHost: 'myhost' }, options: {} });
                expect(ingressSpec).to.nested.include({ 'spec.rules[0].host': 'myhost' });
                expect(ingressSpec).to.nested.include({ 'spec.rules[0].http.paths[0].path': '/hkube/board/myalgo1-board' });
                expect(ingressSpec.spec.rules[0].http.paths[0].backend).to.eql({ serviceName: 'board-service-myalgo1-board', servicePort: 80 });
                expect(ingressSpec.spec.rules[0].http.paths[0].pathTyep).to.not.exist;
                expect(serviceSpec).to.nested.include({ 'spec.selector.app': 'board-myalgo1-board' });
            });
        })
        describe('kubeVersion v1.22', () => {
            before(() => {
                global.testParams.kubernetesMock.kubeVersion.version = 'v1.22'
            });
            after(() => {
                global.testParams.kubernetesMock.kubeVersion.version = 'v1.18'
            });
            it('should include algorithm name and host', () => {
                const { serviceSpec, ingressSpec } = createKindsSpec({ boardReference: 'myalgo1-board', clusterOptions: { ingressHost: 'myhost' }, options: {} });
                expect(ingressSpec).to.nested.include({ 'spec.rules[0].host': 'myhost' });
                expect(ingressSpec).to.nested.include({ 'spec.rules[0].http.paths[0].path': '/hkube/board/myalgo1-board' });
                expect(ingressSpec.spec.rules[0].http.paths[0].backend).to.eql({
                    service: {
                        name: 'board-service-myalgo1-board',
                        port: {
                            number: 80
                        }
                    }
                });
                expect(ingressSpec.spec.rules[0].http.paths[0].pathType).to.exist;
                expect(serviceSpec).to.nested.include({ 'spec.selector.app': 'board-myalgo1-board' });
            });
        })
    });
});
