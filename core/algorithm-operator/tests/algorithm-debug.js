const configIt = require('@hkube/config');
const Logger = require('@hkube/logger');
const { main, logger } = configIt.load();
const log = new Logger(main.serviceName, logger);
const options = main;
const { expect } = require('chai');
const { createIngressServiceSpec } = require('../lib/deployments/algorithm-debug.js');

describe('jobCreator', () => {
    describe('createIngressServiceSpec', () => {
        it('should include algorithm name and host', () => {
            const versions = {
                "versions": [
                    {
                        "project": "worker",
                        "tag": "v1.2.3"
                    }
                ]
            };
            const { serviceSpec, ingressSpec } = createIngressServiceSpec({ algorithmName: 'myalgo1-debug', debugName: 'myalgo1', clusterOptions: { ingressHost: 'myhost' } });
            expect(ingressSpec).to.nested.include({ 'spec.rules[0].host': 'myhost' });
            expect(ingressSpec).to.nested.include({ 'spec.rules[0].http.paths[0].path': '/hkube/debug/myalgo1' });
            expect(serviceSpec).to.nested.include({ 'spec.selector.algorithm-name': 'myalgo1-debug' });
        });
    });
});
